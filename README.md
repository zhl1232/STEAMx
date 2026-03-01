# STEAM Explore & Share

一个面向青少年的STEAM（科学、技术、工程、艺术、数学）项目分享与探索平台。

## 🎯 项目简介

STEAM Explore & Share 是一个互动式学习平台，让孩子们能够：
- 🔍 探索各种有趣的STEAM项目
- 📝 分享自己的创意和作品
- 💬 与其他小伙伴交流讨论
- 🏆 通过完成项目获得成就徽章
- 🎮 参与挑战赛和社区活动

## 🚀 技术栈

- **前端框架**: Next.js 14 (React 18)
- **样式**: Tailwind CSS + shadcn/ui
- **后端服务**: Supabase (数据库 + 认证 + 存储)
- **动画**: Framer Motion
- **类型检查**: TypeScript
- **代码质量**: ESLint + Commitlint + Husky

## ✨ 主要功能

### 用户系统
- ✅ 用户注册与登录（Supabase Auth）
- ✅ 个人资料管理（头像、用户名、简介）
- ✅ 角色权限系统（用户、审核员、管理员）

### 项目管理
- ✅ 浏览和搜索项目
- ✅ 按分类筛选（科学、技术、工程、艺术、数学）
- ✅ 项目详情页（材料清单、制作步骤）
- ✅ 点赞和收藏功能
- ✅ 评论系统

### 社区功能
- ✅ 讨论区（发帖、回复）
- ✅ 挑战赛系统
- ✅ 社区互动

### 游戏化系统
- ✅ 经验值（XP）系统
- ✅ 成就徽章解锁
- ✅ 完成项目追踪

### 管理功能
- ✅ 项目审核系统
- ✅ 标签管理
- ✅ 评论管理
- ✅ 管理员控制台

## 📦 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Supabase 账号

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd steam-explore-share

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的 Supabase 配置
```

### 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 获取项目的 API URL 和 anon key
3. 在 `.env.local` 中配置：

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
```
   set -a && source .env.local && set +a && pnpm exec supabase db push
```
4. 运行数据库迁移：

```bash
# 按顺序执行 supabase/migrations/ 目录下的迁移文件
# 或者使用 Supabase CLI:
supabase db push
```

5. （可选）导入种子数据：

```bash
# 在 Supabase SQL 编辑器中运行
# seed_data.sql 文件
```

详细的数据库设置说明请参考：
- [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) - 认证设置
- [SUPABASE_TABLE_SETUP.md](./SUPABASE_TABLE_SETUP.md) - 数据表设置
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - 迁移指南

### 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
pnpm build
pnpm start
```

## 📁 项目结构

```
steam-explore-share/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 认证相关页面
│   ├── admin/               # 管理员页面
│   ├── api/                 # API 路由
│   ├── community/           # 社区页面
│   ├── profile/             # 用户资料页面
│   └── projects/            # 项目相关页面
├── components/              # React 组件
│   ├── admin/              # 管理组件
│   ├── features/           # 功能组件
│   └── ui/                 # UI 基础组件 (shadcn/ui)
├── context/                # React Context
│   ├── auth-context.tsx    # 认证上下文
│   └── project-context.tsx # 项目数据上下文
├── lib/                    # 工具库
│   ├── supabase/          # Supabase 客户端
│   └── utils.ts           # 通用工具函数
├── supabase/              # Supabase 配置
│   └── migrations/        # 数据库迁移文件
├── public/                # 静态资源
└── hooks/                 # 自定义 React Hooks
```

## 🗄️ 数据库架构

主要数据表：
- `profiles` - 用户资料
- `projects` - 项目信息
- `project_steps` - 项目步骤
- `project_materials` - 项目材料
- `comments` - 评论
- `likes` - 点赞记录
- `completed_projects` - 完成记录
- `discussions` - 讨论
- `challenges` - 挑战赛
- `badges` - 徽章定义
- `user_badges` - 用户徽章
- `tags` - 标签系统

完整的数据库架构请查看 [supabase-schema.sql](./supabase-schema.sql)

## 🔒 权限系统

### 用户角色
- **user** (普通用户): 可以浏览、点赞、评论、创建项目
- **moderator** (审核员): 可以审核项目、管理评论、管理标签
- **admin** (管理员): 拥有所有权限

### 项目状态
- **draft** (草稿): 作者私有
- **pending** (待审核): 提交审核中
- **approved** (已批准): 公开展示
- **rejected** (已拒绝): 需要修改

## 🎨 组件库

使用 [shadcn/ui](https://ui.shadcn.com/) 构建的组件系统，包括：
- Button, Input, Textarea
- Dialog, Dropdown Menu, Tabs
- Avatar, Badge, Progress
- Toast notifications
- 等等...

## 📝 开发规范

### Git 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 添加新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 重构代码
test: 测试相关
chore: 其他修改
```

Husky 会在提交时自动检查提交信息格式。

### 代码风格

- 使用 TypeScript 进行类型检查
- 使用 ESLint 进行代码检查
- 组件使用函数式组件 + Hooks
- 样式使用 Tailwind CSS

## 🚧 开发路线图

查看 [NEXT_STEPS.md](./NEXT_STEPS.md) 了解后续开发计划。

## ☁️ 部署

- **Cloudflare (Workers)**：见 [docs/DEPLOY_CLOUDFLARE.md](./docs/DEPLOY_CLOUDFLARE.md)，使用 OpenNext 适配器部署到 Cloudflare Workers。
  - **注意**：部署到 Cloudflare 时不能使用 Next.js 16 的 `proxy.ts`，OpenNext 仅支持 Edge 的 `middleware.ts`。项目已使用 `middleware.ts` 以兼容 Cloudflare 部署。

## 📚 相关文档

- [AUTH_USER_GUIDE.md](./docs/archive/AUTH_USER_GUIDE.md) - 用户认证指南
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - 数据迁移指南
- [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) - Supabase 认证设置
- [SUPABASE_TABLE_SETUP.md](./SUPABASE_TABLE_SETUP.md) - Supabase 数据表设置

## 🤝 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

---

**让我们一起探索STEAM的奇妙世界！** 🚀✨
