# STEAM 探索

基于项目学习（PBL）的 STEAM 探索平台。

## 🎯 项目简介

STEAM 探索 是一个面向 6-16 岁青少年的互动学习社区，围绕科学实验、技术制作、工程搭建、艺术创作、数学思维和自然观察，通过项目式学习（PBL）驱动成长。

## 🚀 技术栈

- **前端框架**: Next.js 16 + React 19
- **样式系统**: Tailwind CSS + shadcn/ui
- **服务端与数据**: Supabase (数据库 + 认证 + 存储)
- **客户端状态**: TanStack Query v5
- **部署目标**: Docker 镜像 + 自托管服务器
- **工程质量**: TypeScript / Oxlint / Vitest / Playwright / Husky

## ✨ 主要功能

- **项目系统** — 浏览、搜索、分类筛选、项目详情（步骤/材料）、点赞/收藏、评论
- **自然观察** — 鸟类与植物物种库、野外观察记录提交、AI 物种识别、地图标注
- **益智游乐场** — 17 个互动游戏，含五子棋与记忆翻牌实时对战、10 款固定题面游戏的邀请竞速房间，以及扫雷云端榜单
- **社区** — 讨论区、PBL 双轨挑战系统（限时竞赛 + 长期学习）、多维评价
- **游戏化** — XP 经验值/等级、112 枚徽章、STEAM 能力雷达图、排行榜
- **金币经济** — 每日签到获取、打赏创作者、积分商店（头像框/名字颜色/主题）
- **社交** — 关注、私信、弹幕
- **用户系统** — 手机号短信登录、个人主页、新手引导、学习打卡
- **管理后台** — 项目审核、挑战管理、举报处理、审核员系统

## 📁 项目结构

> 详细的模块索引与文件定位见 [PROJECT_INDEX.md](./PROJECT_INDEX.md)
>
> AI/自动化工具开发前必须先读 `PROJECT_INDEX.md` 的相关模块。新增功能、新路由、共享模块、脚本、数据库结构或重要行为变更时，同步更新 `PROJECT_INDEX.md`。
>
> 这些约定也写入了 `AGENTS.md` 和 `.cursor/rules/project-context.mdc`。Next.js 16 已废弃 `middleware.ts` 文件约定；本项目使用根目录 `proxy.ts` 并导出 `proxy`，不要新建或恢复 `middleware.ts`。

```
steam-explore-share/
├── app/                    # App Router 页面与 API 路由
├── components/             # UI 基础组件与业务组件
├── hooks/                  # 自定义 Hooks（游乐场/游戏化/通用）
├── lib/                    # 核心库（Supabase/Context/API/Config/工具）
├── supabase/               # 数据库迁移与种子数据
├── scripts/                # 数据脚本（图片抓取/压缩/DB推送）
├── deploy/                 # Docker/Nginx 部署配置
├── docs/                   # 设计文档
├── __tests__/              # 单元测试
├── e2e/                    # Playwright E2E 测试
└── public/                 # 静态资源（图片/图标/头像）
```

## 📦 快速开始

### 环境要求

- Node.js 20+
- pnpm 10.22.0
- Supabase 账号

### 安装

```bash
pnpm install
cp .env.example .env.local
# 编辑 .env.local 填入 Supabase 配置
```

### 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 在 `.env.local` 中配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 运行数据库迁移：

```bash
# 使用自定义推送工具
set -a && source .env.local && set +a && pnpm db:push
```

> 本项目统一通过 `pnpm db:push` 推送迁移，不使用 `supabase db push`。迁移规则见 `.cursor/rules/db-migrations.mdc`；数据库连接说明见 [docs/database-psql.md](./docs/database-psql.md)。

### 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 🔒 权限系统

| 角色 | 权限 |
|------|------|
| **user** | 浏览、点赞、评论、创建项目、提交观察 |
| **moderator** | 审核项目、管理评论、管理标签 |
| **admin** | 所有权限 + 管理后台 |

## ☁️ 部署

- **生产发布**：Docker 部署，GitHub Actions 构建镜像后通过 SSH 发布到服务器
- **CI**：Oxlint、TypeScript、Vitest、Next build、Playwright smoke

## 📝 开发规范

- [Conventional Commits](https://www.conventionalcommits.org/) 提交规范（Husky 自动检查）
- TypeScript 严格模式
- Oxlint 代码检查

## 📚 相关文档

- [PROJECT_INDEX.md](./PROJECT_INDEX.md) — 完整功能索引与代码定位
- [docs/database-psql.md](./docs/database-psql.md) — psql 迁移与重置说明
- [docs/custom-sms-and-manual-users.md](./docs/custom-sms-and-manual-users.md) — 自建短信登录方案
- [docs/PBL_CHALLENGE_SYSTEM.md](./docs/PBL_CHALLENGE_SYSTEM.md) — PBL 挑战系统设计
- [docs/PBL_CHALLENGE_CONTENT_MODEL.md](./docs/PBL_CHALLENGE_CONTENT_MODEL.md) — PBL 内容模型

## 📄 许可证

[MIT License](LICENSE)
