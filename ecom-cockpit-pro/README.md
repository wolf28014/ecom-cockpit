# 电商经营驾驶舱 Pro V1.0

> 专为淘宝/天猫/抖店/拼多多商家设计的经营数据分析与 AI 决策助手
> Windows 桌面应用 · Python + PySide6 + GLM-4 · 苹果简约风 UI

## 📦 功能特性

### 12 大核心模块

| 模块 | 功能 |
|------|------|
| 🏠 首页驾驶舱 | 今日/本周/本月/本年 KPI 看板 + 趋势图 + 利润目标进度 |
| 🏬 多店铺管理 | 4 平台（淘宝/天猫/抖店/拼多多）店铺增删改查 + 多店对比 |
| ✏️ 数据录入 | 销售/推广/成本三类数据录入，自动计算 8 项指标 |
| 📁 Excel 导入 | 拖拽导入 + 字段自动识别 + 批量导入 + 模板下载 |
| 📊 经营分析中心 | 日/周/月/年 四档分析，含环比/同比/趋势 |
| 🤖 AI 经营中心 | GLM-4 生成日报/周报/月报 + 老板助手聊天 + 经营建议 |
| 🎯 利润目标管理 | 年/季/月度目标 + 完成率 + AI 目标预测 |
| 💰 现金流预测 | 7/30/90 天预测 + AI 经营模拟（"如果推广增加 20%"）|
| 🏷️ SKU 利润分析 | 爆款/利润/滞销/高退款 四类排行榜 |
| 📄 报表中心 | Excel/PDF/Word/PPT 一键导出 |
| ⚙️ 系统设置 | AI 配置 / 预警阈值 / 公司信息 |
| 💾 数据备份 | 手动/自动备份 + 一键恢复 |

### AI 能力（基于 GLM-4）

- **AI 经营日报** - 自动总结今日经营情况，给出优化建议
- **AI 经营周报** - 总结本周爆款表现、推广效果、利润变化
- **AI 经营月报** - 月度总结 + 问题诊断 + 下月建议
- **AI 老板助手** - 聊天式问答："为什么利润下降？"、"本月哪些产品最赚钱？"
- **AI 经营建议** - 5 维度建议：销售/推广/定价/库存/风险
- **AI 现金流预测** - 智能预测未来现金流并给出风险提醒
- **AI 经营模拟** - 情景模拟："如果推广增加 20% 预计利润增加多少？"
- **AI 目标预测** - 基于当前进度预测年度目标完成情况

### 异常预警系统

- 销售连续下降预警
- 利润异常下降预警
- 推广 ROI 偏低预警
- 退款率过高预警
- 推广费率过高预警
- 成本异常增加预警
- 现金流风险预警

## 🚀 快速开始

### 方式一：开发模式运行

```bash
# 1. 安装 Python 3.10+（推荐 3.12）
python --version

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动应用
python main.py
```

### 方式二：打包为 Windows EXE

```bash
# Windows 上执行
build.bat
# 或
bash build.sh
```

打包完成后，在 `dist/电商经营驾驶舱Pro/` 目录下找到 `电商经营驾驶舱Pro.exe`，可直接双击运行。

## 📁 项目结构

```
ecom-cockpit-pro/
├── main.py                          # 程序入口
├── requirements.txt                 # 依赖列表
├── build.spec                       # PyInstaller 配置
├── build.bat / build.sh             # 打包脚本
├── README.md                        # 本文档
│
├── app/                             # 应用主包
│   ├── __init__.py
│   ├── config.py                    # 全局配置
│   ├── app_bootstrap.py             # 启动引导
│   │
│   ├── database/                    # 数据层
│   │   ├── connection.py            # SQLite 连接
│   │   ├── models.py                # 11 张数据表
│   │   └── seed.py                  # 演示数据生成器
│   │
│   ├── core/                        # 核心服务层
│   │   ├── analytics.py             # 经营分析服务
│   │   ├── ai_service.py            # GLM-4 AI 服务
│   │   ├── alerts.py                # 异常预警服务
│   │   ├── forecast.py              # 现金流预测服务
│   │   ├── exporter.py              # Excel/PDF/Word/PPT 导出
│   │   └── backup.py                # 数据备份服务
│   │
│   └── ui/                          # UI 层
│       ├── theme.py                 # Apple Numbers 风 QSS
│       ├── main_window.py           # 主窗口 + 侧边导航
│       ├── components/              # 通用组件
│       │   ├── kpi_card.py          # KPI 大数字卡片
│       │   ├── stat_card.py         # 统计卡片
│       │   ├── chart_view.py        # ECharts WebView
│       │   ├── section_card.py      # 分区卡片
│       │   └── empty_state.py       # 空状态
│       └── pages/                   # 12 个业务页面
│           ├── dashboard_page.py    # 首页驾驶舱
│           ├── stores_page.py       # 多店铺管理
│           ├── data_entry_page.py   # 数据录入
│           ├── data_import_page.py  # Excel 导入
│           ├── analytics_page.py    # 经营分析
│           ├── ai_center_page.py    # AI 经营中心
│           ├── profit_target_page.py# 利润目标
│           ├── cashflow_page.py     # 现金流预测
│           ├── sku_page.py          # SKU 分析
│           ├── reports_page.py      # 报表中心
│           ├── settings_page.py     # 系统设置
│           └── backup_page.py       # 数据备份
│
└── scripts/                         # 测试脚本
    ├── test_db.py                   # 数据库测试
    ├── test_services.py             # 核心服务测试
    └── test_ai.py                   # AI 调用测试
```

## 🗄️ 数据库

- **存储**: SQLite（无需安装数据库服务）
- **位置**: `%APPDATA%/EcomCockpitPro/ecom_cockpit.db` (Windows)
- **备份**: `%APPDATA%/EcomCockpitPro/backups/`

### 演示数据

首次启动会自动创建演示数据，便于立即体验：
- 3 个店铺（淘宝/天猫/抖店各 1 个）
- 12 个 SKU（每店 12 个）
- 90 天每日经营数据（含推广/成本/SKU 销售）
- 年度/季度/月度利润目标
- 历史预警记录

## 🎨 UI 设计

**苹果简约风** (Apple Numbers 风)：
- 白底 + 大数字看板
- 柔和卡片阴影
- 圆角 12px
- Apple 色系：`#0071E3` (蓝) / `#34C759` (绿) / `#FF3B30` (红) / `#FF9500` (橙)
- 字体：PingFang SC / Microsoft YaHei

## 🤖 AI 配置

AI 功能通过 `z-ai` CLI 调用 GLM-4 API：

1. 安装 Node.js 18+
2. 全局安装 z-ai SDK：
   ```bash
   npm install -g z-ai-web-dev-sdk
   ```
3. 配置 API Key（参考 z-ai-web-dev-sdk 文档）
4. 验证安装：
   ```bash
   z-ai chat -p "你好"
   ```

> 应用首次启动时，AI 功能会自动检测 z-ai CLI 是否可用。
> 如果不可用，其他功能（数据录入/分析/报表等）仍可正常使用。

## 📊 图表技术

- **渲染引擎**: ECharts 5.4.3 (CDN 加载)
- **容器**: PyQtWebEngine (QWebEngineView)
- **通信**: QWebChannel（Python ↔ JavaScript）
- **图表类型**: 折线图、柱状图、饼图、组合图

> 如果 PyQtWebEngine 不可用，图表组件会降级为占位提示，不影响其他功能。

## 🔧 技术栈

| 层级 | 技术 |
|------|------|
| GUI 框架 | PySide6 6.6+ |
| UI 组件库 | QFluentWidgets (PySide6-Fluent-Widgets) |
| 图表 | ECharts via PyQtWebEngine |
| 数据库 | SQLAlchemy + SQLite |
| AI | GLM-4 via z-ai-web-dev-sdk CLI |
| Excel | openpyxl |
| PDF | ReportLab + Noto Serif SC 字体 |
| Word | python-docx |
| PPT | python-pptx |
| 打包 | PyInstaller |

## 📝 使用流程

```
每天录入数据
    ↓
自动统计分析（首页驾驶舱）
    ↓
AI 生成经营日报/周报/月报
    ↓
AI 预测未来经营趋势
    ↓
辅助老板决策
```

## 🎯 商业化建议

本版本已具备完整的商业 SaaS 桌面产品形态，可直接：
1. **自用** - 作为自己店铺的经营分析系统
2. **销售** - 作为商业软件对外销售
3. **定制** - 基于此版本定制开发客户专属功能

## 📈 后续迭代方向

- **Phase 2 增强**: 云备份（阿里云 OSS / 腾讯云 COS）
- **Phase 3 增强**: 实时数据接入（淘宝开放平台 API）
- **Phase 4 增强**: 多用户协作（团队账号、权限管理）
- **Phase 5 增强**: 移动端 App（iOS / Android）

## 📄 License

MIT License - 可自由用于商业用途

## 🙏 致谢

- [PySide6](https://www.qt.io/qt-for-python) - Qt for Python
- [QFluentWidgets](https://github.com/zhiyiYo/QFluentWidgets) - Fluent Design 组件库
- [ECharts](https://echarts.apache.org/) - 数据可视化
- [GLM-4](https://chatglm.cn) - 智谱 AI 大模型
