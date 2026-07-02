# 电商经营驾驶舱 Pro

> 专为淘宝/天猫/抖店/拼多多商家设计的经营数据分析与 AI 决策助手
> Next.js 16 + TypeScript + Prisma + PostgreSQL + GLM-4

## ✨ 核心功能

12 大模块完整覆盖电商经营全场景：

| 模块 | 功能 |
|------|------|
| 🏠 首页驾驶舱 | 今日/本周/本月/自然年/季节年 KPI + 趋势图 + 利润目标进度 |
| 🏬 多店铺管理 | 4 平台（淘宝/天猫/抖店/拼多多）店铺增删改查 + 多店对比 |
| ✏️ 数据录入 | 每日数据（销售/订单/退款/访客/推广 7 项）+ 月度成本 12 项明细 |
| 📁 Excel 导入 | 拖拽导入 + 字段自动识别 + 批量导入 + 模板下载 |
| 📊 经营分析中心 | 日/周/月/年 四档分析，含自然年/季节年双轨 + 累积指标 + 同比 |
| 🤖 AI 经营中心 | GLM-4 生成日报/周报/月报 + 老板助手聊天 + 经营建议 |
| 🎯 利润目标管理 | 年/季/月度目标 + 完成率 + AI 目标预测 |
| 💰 现金流预测 | 7/30/90 天预测 + AI 经营模拟（"如果推广增加 20%"）|
| 🏷️ SKU 利润分析 | 爆款/利润/滞销/高退款 四类排行榜 |
| 📄 报表中心 | Excel/PDF/Word/PPT 一键导出 |
| ⚙️ 系统设置 | AI 配置 / 预警阈值 / 公司信息 |
| 💾 数据备份 | 手动/自动备份 + 一键恢复 |

## 🚀 快速部署到 Vercel（推荐）

详细步骤请看 [**DEPLOY.md**](./DEPLOY.md)，简单来说：

1. **代码推到 GitHub** 仓库
2. **Vercel 一键导入** GitHub 仓库
3. **创建 Vercel Postgres** 数据库（免费 256MB）
4. **配置 DATABASE_URL** 环境变量
5. **Deploy** → 等 2-3 分钟
6. **本地跑 seed** 写入演示数据
7. 打开 `https://your-app.vercel.app` 即可使用 ✅

部署完成后：
- ✅ 跨设备同步（手机/电脑/平板访问同一链接）
- ✅ 自动 HTTPS
- ✅ git push 后自动升级
- ✅ 永久免费

## 🛠️ 本地开发

```bash
# 1. 安装依赖
bun install

# 2. 配置数据库连接（本地 PostgreSQL 或 Vercel Postgres 连接串）
cp .env.example .env
# 编辑 .env 填写 DATABASE_URL

# 3. 推送数据库 schema
bun run db:push

# 4. 写入演示数据
bun scripts/seed.ts

# 5. 启动开发服务器
bun run dev
```

打开 http://localhost:3000 即可。

## 📦 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui + Recharts |
| 数据库 | PostgreSQL via Prisma ORM |
| AI | GLM-4 via z-ai CLI |
| 部署 | Vercel + Vercel Postgres |
| 包管理 | Bun |

## 📁 项目结构

```
src/
├── app/
│   ├── api/              # 17 个 API 路由
│   ├── layout.tsx
│   └── page.tsx          # 主入口（侧边导航 + 12 个页面切换）
├── components/
│   ├── ecom/
│   │   ├── kpi.tsx       # KPI 卡片组件
│   │   ├── store-selector.tsx
│   │   └── pages/        # 12 个业务页面
│   └── ui/               # 48 个 shadcn 组件
└── lib/
    ├── analytics.ts      # 经营分析服务（含季节年/累积指标）
    ├── ai.ts             # GLM-4 AI 服务
    └── db.ts             # Prisma 客户端

prisma/
└── schema.prisma         # 11 张表定义（PostgreSQL）

scripts/
└── seed.ts               # 演示数据生成（3 店铺 + 90 天数据 + 4 个月度成本）
```

## 📝 数据说明

- **数据库**：PostgreSQL（Vercel Postgres 免费版 256MB）
- **演示数据**：3 个店铺 / 36 个 SKU / 90 天每日数据 / 4 个月度成本 / 3 条利润目标 / 2 条预警
- **数据备份**：可在 Vercel Storage 后台一键导出 SQL

## 📄 License

MIT
