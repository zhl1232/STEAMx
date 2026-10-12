# 注册资料补建

生产（阿里云托管 Supabase、PG15）存在 `public.handle_new_user()`，但 `auth.users` 未挂任何触发器。原生短信、管理员建号和 OAuth callback 不保证创建 `profiles`，因而新号可能缺资料，并在签到等外键写入时得到 23503。

## 两层恢复

- `20261012100000_ensure_profile_on_signup.sql` 更新函数并挂 `on_auth_user_created` AFTER INSERT 触发器。已有同名触发器跳过并 NOTICE；函数 SECURITY DEFINER、空 search_path，表名全限定，并撤销 PUBLIC/anon/authenticated 直接执行权限。触发器调用不需要注册用户拥有函数 EXECUTE。
- `lib/auth/ensure-profile.ts` 是 server-only 管理端兜底。先读取 id，已存在即返回；插入使用 `onConflict: id, ignoreDuplicates: true`，只返回实际插入是否成功，不覆盖已有资料。原生短信登录、旧短信登录、管理员建号和 callback 均调用它，失败只记录日志并返回失败，不改变原登录/建号响应。
- `POST /api/profile/ensure` 只接受 `auth.getUser()` 验证的当前身份，忽略 body，未登录 401，按请求 IP 和用户限流。签到遇到 23503 时调用此接口，HTTP 和 JSON `ok` 均成功才重试 RPC；失败走既有有界延迟重试。

username 去两端空格；缺失、少于三个 Unicode 字符或被其他资料占用时，生成 `user_` 加八位随机小写 hex；唯一约束竞态最多尝试五次。SQL 最外层捕获异常、只 WARNING SQLSTATE 并返回 new，不因资料失败阻断注册。服务端也捕获所有数据库/网络错误，不输出用户名或原始数据库详情。

显示名保留 20260801 规则：full_name 去空格后为空，或其数字与手机号吻合时，使用「新用户」加四位大写 hex。服务端复用显示名工具的可选 hex 模式，不改变其他调用默认字符集。头像分别保留指定的 SQL `hashtext` 规则和 JS `getDefaultAvatarPath(userId)`；两者都是十二个默认头像，但现有哈希算法不同，同一 ID 不保证得到相同编号。先成功创建的一方决定头像，另一方不会覆盖。

## 阿里云权限

迁移工具通过 pg-meta 使用非 superuser 的 postgres。auth.users 属于 supabase_auth_admin；postgres 有 TRIGGER 权限，足够 CREATE TRIGGER，但不是表 owner，不能 DROP 已存在的触发器。故不能用 DROP TRIGGER IF EXISTS 再创建：IF EXISTS 只在不存在时跳过，存在时依然因所有权失败。本迁移用 pg_catalog.pg_trigger 检查后按需创建。重复执行会替换函数定义并跳过已有同名触发器；上线人工核对已有同名触发器确实指向此函数。不要并行执行多个迁移进程。

## 生产上线（须另获用户授权）

本次只交付代码与本地测试，未执行远端检查或迁移。

1. 获得生产只读检查授权后，运行 `pnpm ops:check-profiles`（Node 22），保留数量基线；或在 GitHub Actions 手动运行 `ops-readonly-missing-profiles.yml`，环境为 Production。脚本只 GET auth admin 用户列表和 profiles 的 id，不建号、不补资料、不写迁移追踪表。输出数量、缺失用户 ID 前八位与 created_at；不输出邮箱、手机号或密钥。退出码：0 无缺失，1 有缺失，2 配置/网络/响应错误。
2. 单独获得**仅应用此迁移**的用户授权后，核对目标与全部待执行迁移。先执行 `pnpm db:push` 应用 `20261012100000_ensure_profile_on_signup.sql`，再部署应用。该工具会应用全部 pending；只有确认 pending 仅此文件时才能执行，否则停止并调整执行范围，不把其他迁移一并应用。不要用 `db:status` 或 `db:push -- --dry-run` 当作只读检查，它们会创建追踪表。
3. 按授权发布应用，验证正常登录和已有账号补建。再次运行只读检查比较缺失数；本迁移不批量回填历史用户，尚未登录/签到的历史缺失仍会保留，脚本仍可能退出 1。观察日志中的补建失败及 SQL WARNING。

脚本优先使用进程环境中的 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY；未配置时才从本地 `.env.local` 补充。GitHub secrets 没有 SUPABASE_SERVICE_ROLE_KEY；生产密钥保存在服务器 `/opt/steam-app/.env.production`，由 `deploy/docker-compose.yml` 的 env_file 注入 `steam-app` 容器。

workflow 使用 Production 环境的 SERVER_HOST / SERVER_USER / SSH_PRIVATE_KEY / SERVER_PORT（默认 22），以独立 concurrency 组串行执行，不占用发布组。runner 使用 Node 22 对两个脚本执行 `node --check`，不安装依赖；scp-action 将两文件按 `scripts/`、`scripts/lib/` 相对结构复制到服务器 `/tmp/steam-profile-check-${run_id}-${run_attempt}/`。ssh-action 通过 tar 和 `docker exec -i` 放到容器内本次运行专用的 `/tmp/pc-${run_id}-${run_attempt}/`，入口旁保留 `lib/missing-profiles.mjs`，随后用容器的 Node 22 运行入口。检查直接复用容器环境，不读取、复制或打印生产 env 文件，不向 runner 传递 Supabase 密钥。

SSH shell 用 EXIT trap 清理服务器和容器临时目录，并保留检查脚本原始退出码 0/1/2，使有缺失或配置/网络错误时 job 失败；不重建或重启应用容器。分页读取不是数据库一致性快照，扫描期间新增/删除用户可能造成短暂差异，必要时授权重跑核对。

## 后续监测

当前 workflow 仅 workflow_dispatch，没有 schedule。未来明确授权定时监测后，只需在 `on` 增加 `schedule`（例如 `cron: '0 1 * * *'`，每天 UTC 01:00 / 北京时间 09:00）并配置失败通知，保留 Production 环境保护和 contents: read 权限；当前不启用定时任务。接 CI 时可增加独立只读 job 调用同一脚本，让 1/2 标红并配置通知；不要把 service role secret 暴露给不可信 PR/fork，也不要为消除告警自动创建账号或写数据库。
