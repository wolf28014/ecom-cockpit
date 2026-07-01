"""
ECharts WebView 组件 - 通过 PyQtWebEngine 渲染
"""
import json
from typing import Optional
from pathlib import Path

from PySide6.QtCore import Qt, QUrl, Slot, QObject, Signal
from PySide6.QtWidgets import QFrame, QVBoxLayout, QSizePolicy, QWidget, QLabel
from PySide6.QtGui import QColor

from app.config import ECHARTS_DIR

# 尝试导入 QtWebEngine；不可用时降级到 QLabel 占位
try:
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWebChannel import QWebChannel
    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False


# ECharts HTML 模板（内嵌 ECharts CDN，离线时回退到本地）
ECHARTS_HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ECharts</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; background: transparent; }
        #chart { width: 100%; height: 100%; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
</head>
<body>
    <div id="chart"></div>
    <script>
        var chart = echarts.init(document.getElementById('chart'), null, {renderer: 'canvas'});

        // 接收 Python 端的 option
        new QWebChannel(qt.webChannelTransport, function(channel) {
            window.bridge = channel.objects.bridge;
            if (window.bridge) {
                window.bridge.optionChanged.connect(function(optionJson) {
                    try {
                        var option = JSON.parse(optionJson);
                        chart.setOption(option, true);
                    } catch (e) {
                        console.error('Set option failed:', e);
                    }
                });
            }
        });

        window.addEventListener('resize', function() { chart.resize(); });
    </script>
</body>
</html>
"""


class ChartBridge(QObject):
    """WebChannel 桥接对象"""
    optionChanged = Signal(str)


class ChartView(QFrame):
    """ECharts 图表组件"""

    def __init__(self, parent=None, height: int = 300):
        super().__init__(parent)
        self.setObjectName("CardWidget")
        self.setMinimumHeight(height)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self._option: dict = {}
        self._last_method: str = ""
        self._last_args: tuple = ()

        if HAS_WEBENGINE:
            self.web_view = QWebEngineView()
            self.web_view.setMinimumHeight(height - 4)

            self.channel = QWebChannel()
            self.bridge = ChartBridge()
            self.channel.registerObject("bridge", self.bridge)
            self.web_view.page().setWebChannel(self.channel)

            layout.addWidget(self.web_view)

            # 写入 HTML 文件
            self._html_path = ECHARTS_DIR / "chart_template.html"
            self._ensure_html_file()

            # 加载
            self.web_view.load(QUrl.fromLocalFile(str(self._html_path)))
        else:
            # 占位 Widget（QtWebEngine 不可用）
            self.placeholder = QLabel("📊 图表组件\n\n(需要 PyQtWebEngine 才能显示图表)\n\n已安装 PySide6-Addons 后即可正常显示")
            self.placeholder.setAlignment(Qt.AlignCenter)
            self.placeholder.setStyleSheet("color: #6E6E73; font-size: 14px; background: #F5F5F7; border-radius: 8px;")
            layout.addWidget(self.placeholder)

    def _ensure_html_file(self):
        ECHARTS_DIR.mkdir(parents=True, exist_ok=True)
        if not self._html_path.exists():
            self._html_path.write_text(ECHARTS_HTML_TEMPLATE, encoding="utf-8")

    def set_option(self, option: dict):
        """设置 ECharts 配置"""
        self._option = option
        if HAS_WEBENGINE:
            option_json = json.dumps(option, ensure_ascii=False, default=str)
            self.bridge.optionChanged.emit(option_json)

    # ============== 预设图表 ==============
    def show_line_chart(self, title: str, x_data: list, series: list,
                       legend: list = None, smooth: bool = True,
                       area: bool = False):
        """折线图
        series: [{"name": "销售额", "data": [...], "color": "#0071E3"}]
        """
        option = {
            "title": {"text": title, "left": "left", "textStyle": {"fontSize": 14, "fontWeight": 600, "color": "#1D1D1F"}},
            "tooltip": {"trigger": "axis"},
            "legend": {"data": legend or [s["name"] for s in series], "bottom": 0},
            "grid": {"top": 50, "left": 50, "right": 20, "bottom": 40},
            "xAxis": {"type": "category", "data": x_data, "axisLine": {"lineStyle": {"color": "#E5E5EA"}}, "axisLabel": {"color": "#6E6E73"}},
            "yAxis": {"type": "value", "axisLine": {"show": False}, "splitLine": {"lineStyle": {"color": "#F2F2F7"}}, "axisLabel": {"color": "#6E6E73"}},
            "series": [{
                "name": s["name"],
                "type": "line",
                "data": s["data"],
                "smooth": smooth,
                "symbol": "circle",
                "symbolSize": 6,
                "itemStyle": {"color": s.get("color", "#0071E3")},
                "lineStyle": {"width": 2, "color": s.get("color", "#0071E3")},
                "areaStyle": {"opacity": 0.1} if area else None,
            } for s in series]
        }
        self.set_option(option)

    def show_bar_chart(self, title: str, x_data: list, series: list, legend: list = None):
        """柱状图"""
        option = {
            "title": {"text": title, "left": "left", "textStyle": {"fontSize": 14, "fontWeight": 600, "color": "#1D1D1F"}},
            "tooltip": {"trigger": "axis"},
            "legend": {"data": legend or [s["name"] for s in series], "bottom": 0},
            "grid": {"top": 50, "left": 50, "right": 20, "bottom": 40},
            "xAxis": {"type": "category", "data": x_data, "axisLine": {"lineStyle": {"color": "#E5E5EA"}}, "axisLabel": {"color": "#6E6E73"}},
            "yAxis": {"type": "value", "axisLine": {"show": False}, "splitLine": {"lineStyle": {"color": "#F2F2F7"}}, "axisLabel": {"color": "#6E6E73"}},
            "series": [{
                "name": s["name"],
                "type": "bar",
                "data": s["data"],
                "itemStyle": {"color": s.get("color", "#0071E3"), "borderRadius": [4, 4, 0, 0]},
                "barWidth": "60%",
            } for s in series]
        }
        self.set_option(option)

    def show_pie_chart(self, title: str, data: list, donut: bool = True):
        """饼图
        data: [{"name": "直通车", "value": 1234}, ...]
        """
        option = {
            "title": {"text": title, "left": "left", "textStyle": {"fontSize": 14, "fontWeight": 600, "color": "#1D1D1F"}},
            "tooltip": {"trigger": "item", "formatter": "{a} <br/>{b}: ¥{c} ({d}%)"},
            "legend": {"orient": "vertical", "right": 10, "top": "middle"},
            "series": [{
                "name": title,
                "type": "pie",
                "radius": ["45%", "70%"] if donut else "60%",
                "center": ["40%", "55%"],
                "data": data,
                "label": {"color": "#6E6E73"},
                "itemStyle": {"borderColor": "#FFFFFF", "borderWidth": 2},
                "color": ["#0071E3", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5856D6", "#FF2D55"],
            }]
        }
        self.set_option(option)

    def show_mix_chart(self, title: str, x_data: list, lines: list, bars: list):
        """组合图（柱+线）
        lines: [{"name": "利润率", "data": [...], "color": "#FF9500"}]
        bars: [{"name": "销售额", "data": [...], "color": "#0071E3"}]
        """
        series = []
        for b in bars:
            series.append({
                "name": b["name"], "type": "bar", "data": b["data"],
                "itemStyle": {"color": b.get("color", "#0071E3"), "borderRadius": [4, 4, 0, 0]},
                "barWidth": "40%",
            })
        for l in lines:
            series.append({
                "name": l["name"], "type": "line", "data": l["data"],
                "smooth": True, "yAxisIndex": 1,
                "itemStyle": {"color": l.get("color", "#FF9500")},
                "lineStyle": {"width": 2, "color": l.get("color", "#FF9500")},
            })

        option = {
            "title": {"text": title, "left": "left", "textStyle": {"fontSize": 14, "fontWeight": 600, "color": "#1D1D1F"}},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "cross"}},
            "legend": {"data": [s["name"] for s in series], "bottom": 0},
            "grid": {"top": 50, "left": 60, "right": 60, "bottom": 40},
            "xAxis": {"type": "category", "data": x_data, "axisLine": {"lineStyle": {"color": "#E5E5EA"}}, "axisLabel": {"color": "#6E6E73"}},
            "yAxis": [
                {"type": "value", "axisLine": {"show": False}, "splitLine": {"lineStyle": {"color": "#F2F2F7"}}, "axisLabel": {"color": "#6E6E73"}},
                {"type": "value", "axisLine": {"show": False}, "splitLine": {"show": False}, "axisLabel": {"color": "#6E6E73", "formatter": "{value}%"}},
            ],
            "series": series,
        }
        self.set_option(option)
