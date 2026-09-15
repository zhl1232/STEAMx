# 使用 psql 直连数据库（阿里云 AnalyticDB PostgreSQL 版）

本项目使用第三方托管的 Supabase 兼容服务。迁移主流程是 `pnpm db:push`，由 `scripts/db-push.mjs` 通过 Supabase **pg-meta `/pg/query` API** 执行 SQL，不是直连 PostgreSQL，也不支持官方 Supabase CLI。

## 直连步骤

### 1. 设置白名单

- 进入 [阿里云 AnalyticDB 控制台](https://adbs.console.aliyun.com/)
- 左侧导航栏点击 **Supabase** → 找到目标项目
- 点击 **修改白名单**，添加您的公网 IP

### 2. （可选）重置密码

- 点击 **修改密码**，设置并保存数据库账号密码

### 3. 获取连接信息

| 项     | 说明 |
|--------|------|
| **端口** | `5432` |
| **连接地址** | 控制台 → **管理** → 跳转。若跳转 URL 为 `http://<IP>:8000`，则 `<IP>` 即为数据库主机地址 |
| **用户名** | 默认为 `postgres` |
| **密码** | 控制台中设置或修改的密码 |
| **数据库名** | 一般为 `postgres`（以控制台实际为准） |

### 4. 使用 psql 连接

在终端使用 PostgreSQL 官方命令行客户端 **psql** 连接：

```bash
psql -h <IP> -p 5432 -U postgres -d postgres
```

按提示输入密码后即可进入交互式 SQL 环境。

也可通过环境变量或连接串避免交互输入密码（注意勿将密码提交到版本库）：

```bash
PGPASSWORD=你的密码 psql -h <IP> -p 5432 -U postgres -d postgres
```

## 使用 psql 执行迁移与种子数据

- **执行种子说明/脚本**（若存在 `supabase/seed.sql`）：

  ```bash
  psql -h <IP> -p 5432 -U postgres -d postgres -f supabase/seed.sql
  ```

## 迁移命令与边界

```bash
pnpm db:status
pnpm db:push
pnpm db:push -- --dry-run
```

工具在 `public._schema_migrations` 追踪已执行版本，并只通过 pg-meta API 应用待执行迁移。`db:status` 与 `--dry-run` 都会先执行 `CREATE TABLE IF NOT EXISTS` 初始化追踪表，因此不是无副作用的只读预检；必须已有目标环境写入授权才能运行。执行前核对目标环境、全部待执行文件及授权范围。

日常部署不要清空 schema、逐个重跑历史迁移、直接用 `psql -f` 执行迁移或 seed，也不要使用 `supabase db push`。若确有数据库运维需要直连，可使用 DBeaver/DataGrip/psql 做经授权的诊断或单次运维操作，但不得替代项目迁移追踪流程。
