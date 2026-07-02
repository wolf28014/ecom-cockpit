"""
AI 经营中心页
=================
包含 4 个子 Tab：
- AI 经营日报 / 周报 / 月报
- AI 老板助手聊天
- AI 经营建议
"""
from datetime import date, datetime
from typing import Optional

from PySide6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QLabel, QPushButton, QComboBox, QTabWidget,
    QWidget, QTextBrowser, QTextEdit, QScrollArea, QFrame, QSplitter,
    QListWidget, QListWidgetItem, QSizePolicy, QMessageBox
)
from PySide6.QtCore import Qt, QThread, Signal, QTimer

from app.ui.pages.base_page import BasePage
from app.ui.components.section_card import SectionCard
from app.database.connection import get_session
from app.database.models import Store, AIReport, ChatHistory
from app.core.ai_service import AIService


# ============== 后台 AI 任务 ==============
class AIReportTask(QThread):
    """AI 报告生成后台任务"""
    finished = Signal(object)
    error = Signal(str)
    progress = Signal(str)

    def __init__(self, store_id: int, report_type: str):
        super().__init__()
        self.store_id = store_id
        self.report_type = report_type

    def run(self):
        try:
            self.progress.emit("AI 正在生成报告，请稍候...")
            with get_session() as session:
                svc = AIService(session)
                if self.report_type == "daily":
                    report = svc.generate_daily_report(self.store_id)
                elif self.report_type == "weekly":
                    report = svc.generate_weekly_report(self.store_id)
                elif self.report_type == "monthly":
                    report = svc.generate_monthly_report(self.store_id)
                elif self.report_type == "yearly":
                    report = svc.generate_yearly_report(self.store_id)
                elif self.report_type == "suggestion":
                    report = svc.generate_suggestions(self.store_id)
                else:
                    raise ValueError(f"未知报告类型: {self.report_type}")
                self.finished.emit(report)
        except Exception as e:
            self.error.emit(str(e))


class AIChatTask(QThread):
    """AI 聊天后台任务"""
    finished = Signal(str)
    error = Signal(str)

    def __init__(self, store_id: int, question: str):
        super().__init__()
        self.store_id = store_id
        self.question = question

    def run(self):
        try:
            with get_session() as session:
                svc = AIService(session)
                answer = svc.boss_chat(self.store_id, self.question)
                self.finished.emit(answer)
        except Exception as e:
            self.error.emit(str(e))


class AICenterPage(BasePage):
    title = "AI 经营中心"
    subtitle = "GLM-4 驱动的智能经营分析与决策助手"

    def __init__(self):
        super().__init__()
        self.current_store_id = 0
        self._ai_task: Optional[QThread] = None

        # 顶部工具栏
        toolbar = QHBoxLayout()
        toolbar.addWidget(QLabel("选择店铺:"))
        self.store_combo = QComboBox()
        self.store_combo.setMinimumWidth(220)
        self.store_combo.currentIndexChanged.connect(lambda _: self.refresh())
        toolbar.addWidget(self.store_combo)
        toolbar.addStretch()
        self.add_layout(toolbar)

        # Tab 切换
        self.tabs = QTabWidget()

        self.daily_tab = QWidget()
        self.weekly_tab = QWidget()
        self.monthly_tab = QWidget()
        self.chat_tab = QWidget()
        self.suggestion_tab = QWidget()

        self.tabs.addTab(self.daily_tab, "AI 经营日报")
        self.tabs.addTab(self.weekly_tab, "AI 经营周报")
        self.tabs.addTab(self.monthly_tab, "AI 经营月报")
        self.tabs.addTab(self.chat_tab, "AI 老板助手")
        self.tabs.addTab(self.suggestion_tab, "AI 经营建议")

        self._init_report_tab(self.daily_tab, "daily")
        self._init_report_tab(self.weekly_tab, "weekly")
        self._init_report_tab(self.monthly_tab, "monthly")
        self._init_chat_tab()
        self._init_report_tab(self.suggestion_tab, "suggestion")

        self.add_widget(self.tabs)
        self.add_stretch()

        self._load_stores()

    def _init_report_tab(self, tab: QWidget, report_type: str):
        layout = QVBoxLayout(tab)
        layout.setSpacing(12)

        # 按钮行
        btn_row = QHBoxLayout()
        btn_row.addStretch()

        gen_btn = QPushButton("生成 AI 报告")
        gen_btn.setObjectName("PrimaryButton")
        gen_btn.clicked.connect(lambda: self._generate_report(report_type))
        btn_row.addWidget(gen_btn)

        layout.addLayout(btn_row)

        # 报告内容
        section = SectionCard("报告内容", "由 GLM-4 自动生成")
        self._report_browsers: dict = getattr(self, "_report_browsers", {})
        browser = QTextBrowser()
        browser.setOpenExternalLinks(True)
        browser.setStyleSheet("""
            QTextBrowser {
                background: #FFFFFF;
                border: 1px solid #E5E5EA;
                border-radius: 8px;
                padding: 16px;
                font-size: 14px;
                line-height: 1.6;
                color: #1D1D1F;
            }
        """)
        browser.setMinimumHeight(500)
        section.add_widget(browser)
        self._report_browsers[report_type] = browser
        layout.addWidget(section)

    def _init_chat_tab(self):
        layout = QVBoxLayout(self.chat_tab)
        layout.setSpacing(12)

        # 历史记录
        history_section = SectionCard("对话历史", "老板与 AI 助手的对话")
        self.chat_history = QTextBrowser()
        self.chat_history.setMinimumHeight(400)
        self.chat_history.setStyleSheet("""
            QTextBrowser {
                background: #FFFFFF;
                border: 1px solid #E5E5EA;
                border-radius: 8px;
                padding: 16px;
                font-size: 14px;
            }
        """)
        history_section.add_widget(self.chat_history)
        layout.addWidget(history_section)

        # 快捷问题
        quick_section = SectionCard("快捷提问", "点击直接提问")
        quick_layout = QHBoxLayout()
        quick_layout.setSpacing(8)
        for q in ["为什么利润下降？", "为什么订单上涨但利润下降？", "本月哪些产品最赚钱？", "应该增加广告预算吗？", "退款率为什么变高？"]:
            btn = QPushButton(q)
            btn.setStyleSheet("padding: 6px 12px; font-size: 12px;")
            btn.clicked.connect(lambda checked=False, text=q: self._ask_question(text))
            quick_layout.addWidget(btn)
        quick_layout.addStretch()
        quick_section.add_layout(quick_layout)
        layout.addWidget(quick_section)

        # 输入框
        input_row = QHBoxLayout()
        self.chat_input = QTextEdit()
        self.chat_input.setMaximumHeight(80)
        self.chat_input.setPlaceholderText("请输入您的问题...")
        input_row.addWidget(self.chat_input)

        send_btn = QPushButton("发送")
        send_btn.setObjectName("PrimaryButton")
        send_btn.setFixedWidth(100)
        send_btn.clicked.connect(self._on_send)
        input_row.addWidget(send_btn)

        layout.addLayout(input_row)

    def _load_stores(self):
        self.store_combo.blockSignals(True)
        self.store_combo.clear()
        self.store_combo.addItem("全店铺汇总", 0)
        with get_session() as session:
            stores = list(session.query(Store).filter(Store.is_active == True).order_by(Store.id).all())
            for s in stores:
                self.store_combo.addItem(s.name, s.id)
        self.store_combo.blockSignals(False)

    def refresh(self):
        self._load_stores()
        self.current_store_id = self.store_combo.currentData() or 0
        # 加载最近的报告
        self._load_latest_reports()
        self._load_chat_history()

    def _load_latest_reports(self):
        """加载最近的 AI 报告"""
        try:
            with get_session() as session:
                svc = AIService(session)
                for rtype in ["daily", "weekly", "monthly", "suggestion"]:
                    reports = svc.get_reports(self.current_store_id, rtype, limit=1)
                    if reports:
                        report = reports[0]
                        browser = self._report_browsers.get(rtype)
                        if browser:
                            html = self._markdown_to_html(report.content)
                            browser.setHtml(html)
                    else:
                        browser = self._report_browsers.get(rtype)
                        if browser:
                            browser.setHtml(
                                '<div style="color:#6E6E73;text-align:center;padding:40px;">'
                                '📊<br><br>暂无 AI 报告<br><br>点击上方"生成 AI 报告"按钮，由 GLM-4 自动生成'
                                '</div>'
                            )
        except Exception as e:
            print(f"[WARN] 加载报告失败: {e}")

    def _load_chat_history(self):
        """加载聊天历史"""
        try:
            with get_session() as session:
                svc = AIService(session)
                history = svc.get_chat_history(self.current_store_id, limit=20)
                if not history:
                    self.chat_history.setHtml(
                        '<div style="color:#6E6E73;text-align:center;padding:40px;">'
                        '🤖<br><br>您好，我是 AI 老板助手<br><br>基于您的经营数据，可以问我任何问题'
                        '</div>'
                    )
                    return
                html_parts = []
                for h in history:
                    if h.role == "user":
                        html_parts.append(
                            f'<div style="background:#0071E3;color:white;padding:10px 14px;border-radius:12px;margin:8px 0;margin-left:40px;">'
                            f'<b>您:</b> {h.content}</div>'
                        )
                    else:
                        html_parts.append(
                            f'<div style="background:#F5F5F7;color:#1D1D1F;padding:10px 14px;border-radius:12px;margin:8px 0;margin-right:40px;">'
                            f'<b>🤖 AI:</b> {h.content}</div>'
                        )
                self.chat_history.setHtml("".join(html_parts))
                # 滚动到底部
                self.chat_history.verticalScrollBar().setValue(self.chat_history.verticalScrollBar().maximum())
        except Exception as e:
            print(f"[WARN] 加载聊天历史失败: {e}")

    def _markdown_to_html(self, md: str) -> str:
        """简单的 Markdown 转 HTML"""
        if not md:
            return ""
        import re
        # 标题
        md = re.sub(r'^### (.+)$', r'<h3 style="color:#1D1D1F;margin:16px 0 8px;">\1</h3>', md, flags=re.M)
        md = re.sub(r'^## (.+)$', r'<h2 style="color:#0071E3;margin:20px 0 10px;">\1</h2>', md, flags=re.M)
        md = re.sub(r'^# (.+)$', r'<h1 style="color:#0071E3;margin:24px 0 12px;">\1</h1>', md, flags=re.M)
        # 加粗
        md = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', md)
        # 列表
        md = re.sub(r'^- (.+)$', r'<div style="padding-left:16px;">• \1</div>', md, flags=re.M)
        # 段落
        md = md.replace("\n\n", "<br><br>")
        md = md.replace("\n", "<br>")
        return f'<div style="font-family: PingFang SC, sans-serif; line-height: 1.6;">{md}</div>'

    def _generate_report(self, report_type: str):
        if self._ai_task and self._ai_task.isRunning():
            QMessageBox.warning(self, "提示", "已有 AI 任务在执行，请稍候")
            return

        self.current_store_id = self.store_combo.currentData() or 0

        # 显示加载提示
        browser = self._report_browsers.get(report_type)
        if browser:
            browser.setHtml(
                '<div style="color:#0071E3;text-align:center;padding:60px;">'
                '<b>🤖 GLM-4 正在生成报告...</b><br><br>'
                '正在分析您的经营数据，请稍候 30-60 秒'
                '</div>'
            )

        # 启动后台任务
        self._ai_task = AIReportTask(self.current_store_id, report_type)
        self._ai_task.finished.connect(lambda report: self._on_report_ready(report_type, report))
        self._ai_task.error.connect(lambda err: self._on_report_error(report_type, err))
        self._ai_task.start()

    def _on_report_ready(self, report_type: str, report: AIReport):
        browser = self._report_browsers.get(report_type)
        if browser:
            html = self._markdown_to_html(report.content)
            browser.setHtml(html)
        QMessageBox.information(self, "成功", f"AI 报告已生成！\n\n标题: {report.title}")

    def _on_report_error(self, report_type: str, err: str):
        browser = self._report_browsers.get(report_type)
        if browser:
            browser.setHtml(
                f'<div style="color:#FF3B30;text-align:center;padding:40px;">'
                f'<b>❌ 报告生成失败</b><br><br>{err}'
                f'</div>'
            )
        QMessageBox.critical(self, "失败", f"AI 报告生成失败: {err}")

    def _ask_question(self, question: str):
        self.chat_input.setText(question)
        self._on_send()

    def _on_send(self):
        question = self.chat_input.toPlainText().strip()
        if not question:
            QMessageBox.warning(self, "提示", "请输入问题")
            return
        if self._ai_task and self._ai_task.isRunning():
            QMessageBox.warning(self, "提示", "已有 AI 任务在执行，请稍候")
            return

        self.current_store_id = self.store_combo.currentData() or 0
        self.chat_input.clear()

        # 显示用户问题
        current_html = self.chat_history.toHtml()
        new_html = current_html + f'<div style="background:#0071E3;color:white;padding:10px 14px;border-radius:12px;margin:8px 0;margin-left:40px;"><b>您:</b> {question}</div>'
        self.chat_history.setHtml(new_html)

        # 启动后台任务
        self._ai_task = AIChatTask(self.current_store_id, question)
        self._ai_task.finished.connect(self._on_chat_ready)
        self._ai_task.error.connect(self._on_chat_error)
        self._ai_task.start()

    def _on_chat_ready(self, answer: str):
        current_html = self.chat_history.toHtml()
        new_html = current_html + f'<div style="background:#F5F5F7;color:#1D1D1F;padding:10px 14px;border-radius:12px;margin:8px 0;margin-right:40px;"><b>🤖 AI:</b> {answer}</div>'
        self.chat_history.setHtml(new_html)
        self.chat_history.verticalScrollBar().setValue(self.chat_history.verticalScrollBar().maximum())

    def _on_chat_error(self, err: str):
        current_html = self.chat_history.toHtml()
        new_html = current_html + f'<div style="background:#FFEAEA;color:#FF3B30;padding:10px 14px;border-radius:12px;margin:8px 0;"><b>❌ 错误:</b> {err}</div>'
        self.chat_history.setHtml(new_html)
