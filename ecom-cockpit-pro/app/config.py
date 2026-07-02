"""
全局配置
"""
import os
from pathlib import Path

# ============== 路径配置 ==============
APP_ROOT = Path(__file__).resolve().parent.parent
APP_HOME = APP_ROOT / "app"
RESOURCE_DIR = APP_HOME / "ui" / "resources"
ECHARTS_DIR = RESOURCE_DIR / "echarts"

# 用户数据目录（与 EXE 同级，便于打包后写入）
USER_DATA_DIR = Path(os.getenv("APPDATA", str(APP_ROOT))) / "EcomCockpitPro" if os.name == "nt" \
    else Path.home() / ".ecom_cockpit_pro"
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = USER_DATA_DIR / "ecom_cockpit.db"
DB_URL = f"sqlite:///{DB_PATH}"

BACKUP_DIR = USER_DATA_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

EXPORT_DIR = USER_DATA_DIR / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# ============== 应用配置 ==============
APP_NAME = "电商经营驾驶舱 Pro"
APP_VERSION = "1.0.0"
APP_AUTHOR = "Ecom Cockpit Team"

# ============== AI 配置 ==============
# z-ai CLI 路径（系统已安装）
ZAI_CLI_PATH = "z-ai"
# 默认 AI 模型
DEFAULT_AI_MODEL = "glm-4-plus"
# AI 请求超时（秒）
AI_TIMEOUT = 60

# ============== 店铺平台 ==============
PLATFORM_CHOICES = [
    ("taobao", "淘宝店"),
    ("tmall", "天猫店"),
    ("douyin", "抖店"),
    ("pinduoduo", "拼多多"),
]

# 各平台默认推广字段
PLATFORM_PROMOTION_FIELDS = {
    "taobao": ["直通车", "万相台", "引力魔方", "淘宝客", "其他"],
    "tmall":  ["直通车", "万相台", "引力魔方", "淘宝客", "品牌专区", "其他"],
    "douyin": ["千川投放", "小店随心推", "达人推广", "直播投放", "其他"],
    "pinduoduo": ["多多搜索", "多多场景", "多多进宝", "明星店铺", "其他"],
}

# ============== 预警阈值 ==============
ALERT_THRESHOLDS = {
    "sales_decline_days": 3,         # 销售连续下降天数
    "profit_decline_pct": 0.15,      # 利润下降幅度
    "promotion_roi_min": 1.5,        # 推广 ROI 最低值
    "refund_rate_max": 0.08,         # 退款率最高值
    "promotion_rate_max": 0.25,      # 推广费率最高值
    "cost_increase_pct": 0.20,       # 成本增长幅度
}

# ============== 颜色主题（Apple Numbers 风） ==============
THEME_COLORS = {
    "light": {
        "bg": "#F5F5F7",
        "card_bg": "#FFFFFF",
        "text_primary": "#1D1D1F",
        "text_secondary": "#6E6E73",
        "accent": "#0071E3",          # Apple Blue
        "accent_green": "#34C759",    # Apple Green
        "accent_red": "#FF3B30",      # Apple Red
        "accent_orange": "#FF9500",
        "accent_purple": "#AF52DE",
        "border": "#E5E5EA",
        "shadow": "rgba(0,0,0,0.04)",
    },
    "dark": {
        "bg": "#000000",
        "card_bg": "#1C1C1E",
        "text_primary": "#F5F5F7",
        "text_secondary": "#AEAEB2",
        "accent": "#0A84FF",
        "accent_green": "#30D158",
        "accent_red": "#FF453A",
        "accent_orange": "#FF9F0A",
        "accent_purple": "#BF5AF2",
        "border": "#38383A",
        "shadow": "rgba(0,0,0,0.3)",
    }
}
