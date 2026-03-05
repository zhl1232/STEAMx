# 使用 psql 直连数据库（阿里云 AnalyticDB PostgreSQL 版）

本项目若使用 **阿里云 AnalyticDB PostgreSQL 版的 Supabase 项目**，底层为托管服务，与标准 Supabase 开源版存在差异，**不支持官方 Supabase CLI**（如 `supabase db reset`）。数据库变更需通过 **标准 PostgreSQL 直连** 完成。

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

- **执行单个 SQL 文件**（如某次迁移或 seed）：

  ```bash
  psql -h <IP> -p 5432 -U postgres -d postgres -f supabase/migrations/20260130000001_seed_init.sql
  ```

- **按顺序执行所有迁移文件**（等价于「重新应用全部 migration」）：

  ```bash
  for f in supabase/migrations/*.sql; do psql -h <IP> -p 5432 -U postgres -d postgres -f "$f"; done
  ```

  请确保在项目根目录执行，且迁移文件名排序与预期顺序一致。

- **执行种子说明/脚本**（若存在 `supabase/seed.sql`）：

  ```bash
  psql -h <IP> -p 5432 -U postgres -d postgres -f supabase/seed.sql
  ```

## 等价于「supabase db reset」的操作（慎用）

Supabase CLI 的 `supabase db reset` 会清空后重新跑所有 migration 并执行 seed。用 psql 可做**等价操作**，但会**清空指定 schema 内所有对象**，仅建议在开发/测试环境使用：

1. **清理 public schema**（会删除该 schema 下所有表、函数等）：

   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

   若阿里云 AnalyticDB 上还有 `auth`、`storage` 等 schema，是否一并清理需根据实际环境与运维要求决定；通常只重置 `public` 用于应用表结构。

2. **重新创建扩展与基础对象**（若迁移中依赖的扩展在 `public` 被删后需重新启用，按你们迁移的第一条或运维文档执行，例如）：

   ```sql
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   -- 其他项目需要的 extension
   ```

3. **按顺序执行所有迁移文件**（见上一节 for 循环命令）。

4. **（可选）执行 seed**：`psql ... -f supabase/seed.sql`。

---

其他图形化客户端（如 DBeaver、DataGrip）同样使用上述主机、端口、用户名、密码连接即可；自动化与脚本推荐使用 **psql**。
