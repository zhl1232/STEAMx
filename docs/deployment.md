# 生产部署

核对：2026-10-13，`0d322eda40dfdf81c7feb4f37703c9b38bea2b15`。本文维护应用构建、切换、恢复与运维互斥。数据库命令只在 [数据库连接与迁移](database-psql.md) 维护；模型资源发布见 [LDraw 发布](ldraw-publishing.md)。本次未核验生产运行状态。

## 触发与范围

Release Deploy 在获授权的 main push、`v*` 标签或手动触发时运行。GitHub Actions 构建私有 GHCR 镜像，服务器按本次构建的 SHA-256 摘要拉取；创建 PR 不等于授权合并或发布。

Release 复用 `ci.yml`，检查与镜像构建并行，同一提交的两项均成功后才切换服务器。PR 有独立 CI。测试和镜像使用 Node.js 22；实际流程以对应提交的 `.github/workflows/release.yml`、`ci.yml` 和 `scripts/release-scope.mjs` 为准。

纯文档或允许的课程资源变更按范围规则跳过应用镜像和服务器切换，但仍可能运行 CI；混合应用变更、Release 配置变化、标签及手动发布不能按纯文档处理。仅独立 `ops-*` 工作流或对应手机号运维脚本变化的处理也由范围脚本决定，不能推断任意配置文件均无需部署。

## 构建与缓存

Docker 的 `scratch-builder` 只接收 Scratch 子包及依赖输入，产物处于应用文件之前的独立镜像层；主站运行 `pnpm exec next build`。本地 `pnpm build` 仍同时构建 Scratch 和主站。

首次构建、锁文件或 Scratch 源码/配置变更、基础镜像变化及缓存失效时仍需重建。Actions 缓存用于编译复用，服务器 Docker 缓存用于只下载缺失层，不能保证每次都会命中。

构建前磁盘空间低于 20 GiB 才触发清理 Android、.NET、Haskell 等预装内容，保留工具缓存里的 Node。此阈值不代表实际构建空间或提速承诺。

## 凭据和前置条件

服务器连接复用现有 `SERVER_HOST`、`SERVER_USER`、`SSH_PRIVATE_KEY` 和可选 `SERVER_PORT`。GHCR 使用当次 Actions 的 `GITHUB_TOKEN` 与 `packages: write` 权限；同名包需允许该仓库访问，不新增长期仓库密码或把镜像改为公开。

运行时配置由服务器 `/opt/steam-app/.env.production` 提供。本地同名文件不会自动上传。服务器须能连接 GHCR，Compose 须支持 `up --wait --wait-timeout`；令牌失效后已有本地镜像可继续使用，换服务器或删除本地镜像需通过获授权发布重新取得可用拉取凭证。

## 发布事务与恢复边界

1. 拉取精确镜像，以生产配置启动不发布端口、不运行 worker 的候选容器，检查 `/api/health` 后移除。健康检查只证明进程启动，不证明计费、ASR 或数据库业务正确。
2. 备份并安装候选 Compose、Nginx 配置和启用链接，校验 Nginx；通过后执行本次获批准的限定迁移。
3. 迁移成功后切换主站和 worker，等待健康检查并 reload Nginx。成功才将 `STEAM_APP_IMAGE` 写入服务器 `.env`，保留其他配置。
4. 失败时按脚本恢复原配置；已尝试切换容器时使用部署前实际镜像和原 Compose 恢复，Actions 标记失败。恢复失败保留备份路径，先修复配置/容器，不盲目重跑。

部署 bundle 使用 run/attempt 专属临时目录，完成后清理。发布不自动清空旧镜像，保留恢复所需层。

**容器回滚不等于数据库或业务回滚。** 已提交迁移不会被部署脚本反向修改；旧计费应用可能无法新建旧凭证。迁移后切换失败，应发布兼容已提交结构的应用，不伪造未执行标记、不删减用户账本。

## 数据库与应用版本协调

Release 的 `MIGRATION_ALLOWLIST` 是该提交的批准文件清单。通用指南不写死“本次三条”；[2026-10-13 配置快照](releases/2026-10-13/runtime-migrations.md) 保存本轮核对结果。新增迁移必须另行审查并更新允许名单，不取消范围校验放行。

部署包必须携带完整迁移目录。限定预检要求已有追踪表，发现名单外待执行项会在写入前失败；命令、副作用、事务及首次接入规则统一见 [数据库连接与迁移](database-psql.md)。

生产精简镜像直接以 Node 执行项目自定义迁移脚本，不下载新依赖或使用官方 Supabase CLI。候选与迁移沿用 `docker compose run --no-deps`、既有环境文件和只读脚本/SQL 挂载。应用预检和 Nginx 校验失败时不执行迁移。

## 互斥、超时和手机号运维

Release 与手机号提供商运维共用 `release-production` 并发组，服务器另以 `.deploy.lock` 互斥。默认锁等待 120 秒、镜像拉取单次 180 秒、最多 2 次尝试，分别由 `DEPLOY_LOCK_TIMEOUT`、`IMAGE_PULL_TIMEOUT`、`IMAGE_PULL_ATTEMPTS` 调整。

候选预检默认最多 20 次、间隔 2 秒，每次 HTTP 请求最多 4 秒；相关变量为 `PREFLIGHT_ATTEMPTS`、`PREFLIGHT_INTERVAL_SECONDS`。超时限制不能修复网络问题。

手机号运维只重建主站并保持其实际镜像；失败恢复环境文件和服务，恢复失败保留备份。认证切换的准入和真实短信验收只在 [登录与短信](phone-auth.md) 维护，容器健康不能代替短信送达。

## 部署后的独立检查

SEO 检查在切换后运行；失败可标记 Release 失败并跳过主动推送，但不会自动回滚已经部署的应用，处理见 [SEO 日常运营](seo-daily-operations.md)。

每次发布分别记录代码提交、镜像摘要、迁移结果、应用健康和实际业务检查。没有检查对应数据或真实功能时写“未核验”，不从 workflow 成功推定用户余额、供应商连通或课程体验全部通过。
