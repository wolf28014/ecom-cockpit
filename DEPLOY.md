# 电商经营驾驶舱 Pro - Vercel 部署指南

> 把应用部署到 Vercel，实现跨设备同步、永久免费、自动 HTTPS、自动升级

## 📋 部署前准备

### 1. 注册账号（都用免费版即可）

| 服务 | 用途 | 注册地址 |
|------|------|---------|
| GitHub | 托管代码 | https://github.com/signup |
| Vercel | 部署应用 + 数据库 | https://vercel.com/signup（用 GitHub 账号登录）|

### 2. 在 GitHub 创建仓库

1. 访问 https://github.com/new
2. Repository name 填：`ecom-cockpit`（或您喜欢的名字）
3. 选择 **Public**（私有仓库 Vercel 也能部署，但 Public 更稳）
4. 勾选 **Add a README file**
5. 点击 **Create repository**

---

## 🛠️ 本地开发

### 快速启动（推荐）

```bash
bash scripts/dev-sqlite.sh
```

此脚本会自动：
1. 临时切换 schema 到 SQLite（不影响 git 仓库的 PostgreSQL 版本）
2. 配置 `.env` 指向本地 SQLite 文件
3. 推送 schema 并写入演示数据
4. 启动 dev server

访问 http://localhost:3000 即可。

### 重要：提交代码前

```bash
bash scripts/restore-schema.sh
```

此脚本会恢复 `prisma/schema.prisma` 为 PostgreSQL 版本（部署到 Vercel 必需）。

> 已配置 pre-commit hook 自动检查，如果 schema 是 sqlite 会阻止提交。

### 连接 Vercel Postgres 本地测试

如果想本地连接云数据库测试：

```bash
# 1. 配置 .env
echo 'DATABASE_URL="postgresql://default:xxx@xxx-pooler.xxx.sin1.postgres.vercel-db.neon.tech/ecom_cockpit_db?pgbouncer=true"' > .env

# 2. schema 已经是 postgresql（git 默认版本）

# 3. 推送 schema
bun run db:push

# 4. 启动 dev
bun run dev
```

---

## 🚀 部署步骤

### 步骤 1：把项目代码推到 GitHub

把当前项目的所有文件（除了 `node_modules/`、`.env`、`db/*.db`、`.next/`）上传到您刚创建的仓库。

推荐用 Git 命令行：

```bash
# 在项目根目录执行
git init
git add .
git commit -m "feat: 电商经营驾驶舱 Pro V1.0"
git branch -M main
git remote add origin https://github.com/wolf28014/ecom-cockpit.git
git push -u origin main
```

> 把 `wolf28014` 改成您的 GitHub 用户名，`ecom-cockpit` 改成您的仓库名。

### 步骤 2：在 Vercel 创建项目

1. 访问 https://vercel.com/new
2. 找到刚才的 `ecom-cockpit` 仓库，点击 **Import**
3. Framework Preset 自动识别为 **Next.js**，不要改
4. **先不要点 Deploy**，往下滚动到 **Environment Variables**

### 步骤 3：创建 Vercel Postgres 数据库

1. 在新标签页访问 https://vercel.com/dashboard/stores
2. 点击 **Create Database** → 选择 **Postgres** (Neon)
3. Name 填：`ecom-cockpit-db`
4. Region 选离您最近的（推荐 `Singapore - sin1`）
5. 点击 **Create**
6. 创建完成后，会跳转到数据库详情页，找到 **`.env.local`** 标签
7. 复制 `POSTGRES_PRISMA_URL` 这一行（格式类似 `postgresql://default:xxx@xxx-pooler.xxx.sin1.postgres.vercel-db.neon.tech/ecom_cockpit_db?pgbouncer=true`）

### 步骤 4：在 Vercel 项目中配置环境变量

回到步骤 2 的 Import 页面，在 **Environment Variables** 区域：

- Name 填：`DATABASE_URL`
- Value 填：刚才复制的 `POSTGRES_PRISMA_URL`（**包含 `?pgbouncer=true`** 这一段，重要！）
- 勾选所有环境（Production / Preview / Development）

然后点击 **Deploy**。

### 步骤 5：等待部署完成（约 2-3 分钟）

部署过程中 Vercel 会自动：
1. `bun install` 安装依赖
2. `prisma generate` 生成 Prisma Client（通过 `postinstall` 钩子）
3. `next build` 构建应用

部署成功后，Vercel 会给您一个访问地址，类似：
`https://ecom-cockpit-wolf28014.vercel.app`

### 步骤 6：初始化数据库（写入演示数据）

部署完成后，数据库是空的。需要写入演示数据：

**方法 A（推荐）**：在 Vercel 项目本地连接云数据库跑 seed

```bash
# 在本地项目目录
# 1. 复制 Vercel Postgres 的连接串到 .env
echo 'DATABASE_URL="postgresql://default:xxx@xxx-pooler.xxx.sin1.postgres.vercel-db.neon.tech/ecom_cockpit_db?pgbouncer=true"' > .env

# 2. 推送 schema 到云端
bun run db:push

# 3. 写入演示数据
bun scripts/seed.ts
```

**方法 B**：在 Vercel 后台手动执行

1. Vercel 项目 → Storage → 选中数据库 → Data Explorer
2. 复制 `prisma/schema.prisma` 中的所有 model 定义
3. 通过 Data Explorer 的 SQL 编辑器执行建表 SQL（参考下方）

### 步骤 7：访问应用

打开 `https://ecom-cockpit-wolf28014.vercel.app`，看到首页驾驶舱即部署成功！

---

## 🔧 后续维护

### 更新代码后自动部署

只要您 `git push` 到 GitHub 的 `main` 分支，Vercel 会自动重新部署。约 2 分钟后线上版本更新。

### 自定义域名（可选）

1. Vercel 项目 → Settings → Domains
2. 输入您的域名（如 `cockpit.yourdomain.com`）
3. 按提示在域名服务商添加 CNAME 记录

### 查看日志

Vercel 项目 → deployments → 选中某次部署 → Logs，可以看到所有 API 请求日志和错误。

### 数据库备份

Vercel Postgres 数据可以在 Vercel Storage 页面 → 选中数据库 → Export，导出 SQL 文件。

---

## ❓ 常见问题

### Q1: 部署失败，提示 `Prisma can't reach database`

**原因**：环境变量 `DATABASE_URL` 配置错误。

**解决**：
1. 确认 URL 末尾有 `?pgbouncer=true`（Vercel Postgres 强制要求）
2. 确认勾选了 Production / Preview / Development 三个环境
3. 重新部署：Vercel → Deployments → 右上角菜单 → Redeploy

### Q2: 部署成功但打开页面白屏

**原因**：数据库未初始化。

**解决**：执行部署指南的「步骤 6」初始化数据。

### Q3: AI 功能不工作

**原因**：Vercel 环境没有 `z-ai` CLI。

**解决**：AI 调用需要服务端有 z-ai CLI。在 Vercel 上需要改造为前端直接调用 GLM API，或者在 Vercel 后台配置 `ZAI_API_KEY` 环境变量并改用 SDK 调用。这是后续优化项，不影响其他功能使用。

### Q4: 免费额度够用吗？

Vercel Hobby（免费版）：
- 带宽：100 GB/月
- 函数调用：100,000 次/月
- Serverless 函数执行时间：100 GB-hours/月

Vercel Postgres（免费版）：
- 存储：256 MB（约可存 10 万条每日数据）
- 计算时间：60 hours/月

对单人电商老板日常使用绰绰有余。

### Q5: 数据会被别人看到吗？

会。当前应用是**多用户共享数据**模式（任何打开链接的人都能看到所有店铺数据）。

如果您需要登录功能保护数据，可以后续添加：
- 用 NextAuth.js + GitHub OAuth 登录
- 用 Vercel Password Protection（Hobby 版需要升级）

短期方案：把 Vercel 项目的访问地址设为不可猜测的（如加随机字符串），或绑定自定义域名后不公开分享。

---

## 📞 技术架构

```
GitHub (代码仓库)
    ↓ git push
Vercel (自动构建 + 部署)
    ├── Next.js 前端（CDN 加速）
    ├── Next.js API Routes（Serverless Functions）
    └── Vercel Postgres（云数据库，跨设备同步）
```

**核心优势：**
- ✅ 跨设备同步：手机/电脑/平板，打开同一链接看到相同数据
- ✅ 自动 HTTPS：Vercel 自动签发 SSL 证书
- ✅ 自动升级：git push 后自动部署，无需手动操作
- ✅ 全球加速：Vercel CDN 自动就近访问
- ✅ 永久免费：单人使用完全够用
- ✅ 备份方便：Vercel 后台一键导出 SQL

---

## 🎯 部署后下一步

1. 在「数据录入」页填入您真实的店铺数据
2. 在「系统设置」配置您的公司信息
3. 体验「AI 经营中心」的智能分析
4. 把链接加到手机书签，随时随地查看经营状况

祝您生意兴隆！🚀
