# 生产部署

GitHub Actions 的 Release Deploy 构建镜像并推送 `ghcr.io/zhl1232/steamx`，服务器按本次构建的 `sha256` 摘要拉取。Compose、部署脚本和 Nginx 配置合并一次 SCP，上传到本次 run/attempt 专属临时目录，执行结束后清理。

Release 复用 `ci.yml` 的检查，与 Docker 构建并行；只有同一提交的两项任务都成功，才会运行服务器切换。PR 保留独立 CI，main 不再重复启动另一套 CI。测试与镜像统一使用 Node 22。纯文档/课程资源变更仍运行 CI，但按已有范围规则跳过镜像和服务器切换。

构建前检查磁盘：可用空间低于 20 GiB 才清理 Android、.NET、Haskell，保留工具缓存中的 Node。该阈值是保守起点，实际提速取决于 runner 剩余空间和构建缓存命中率。SEO 检查、报告和百度推送保持部署后执行。

## Scratch 缓存

Docker 的 `scratch-builder` 只接收 Scratch 子包与依赖输入；主站调用 `pnpm exec next build`。Scratch 产物独立放在应用文件之前的镜像层中，因此主站修改通常既不重编译 Scratch，也不重复下载该层。本地 `pnpm build` 仍构建 Scratch 和主站。

首次切换、依赖锁文件或 Scratch 源码/配置变化、基础镜像变化以及缓存失效时仍会重新构建。首次生产拉取也需要完整下载；后续才按缺失层传输。GitHub Actions 缓存用于编译复用，服务器 Docker 层缓存用于下载复用。

## 凭据与前置条件

- 继续使用现有 `SERVER_HOST`、`SERVER_USER`、`SSH_PRIVATE_KEY` 和可选 `SERVER_PORT` secrets。
- GHCR 使用本次 Actions 的 `GITHUB_TOKEN`，workflow 需要 `packages: write`。不新增长期仓库密码，不将镜像设为公开。
- 若 GHCR 中同名包已存在，需允许此仓库的 Actions 访问该包。
- 服务器必须能连接 GHCR，Docker Compose 必须支持 `up --wait --wait-timeout`；首次拉取可能较慢。网络或权限失败时先解决连接问题，再重跑 Release。
- `/opt/steam-app/.env.production` 继续提供运行时配置。临时 Docker 登录目录在部署退出时删除。

## 切换与恢复

部署先拉取精确镜像，再备份并安装候选 Compose、Nginx 配置及启用链接；Nginx 语法通过后启动主站和后台 worker，等待健康检查，最后 reload Nginx。全部成功后将版本写入 `/opt/steam-app/.env` 的 `STEAM_APP_IMAGE`，保留其他配置，普通 `docker compose up -d` 会继续使用这个版本。

配置安装/校验、健康检查或 Nginx reload 失败时，脚本恢复原配置；若已尝试切换容器，再用部署前运行容器的本地镜像和原 Compose 恢复两个服务，并让 Actions 标记失败。镜像拉取失败不会改动线上配置。若配置恢复失败，日志会打印保留的备份目录，需先恢复配置；若容器恢复失败，需查看服务器容器日志。发布不自动清理镜像，以保留恢复所需的层；后续按磁盘使用情况清理更早的版本。

如需人工查看当前版本：

```sh
cd /opt/steam-app
docker compose ps
docker inspect --format '{{.Config.Image}}' steam-app
```

令牌在 Actions 结束后失效；已拉取镜像仍可在本机使用。换服务器或清理本地镜像后，应重新运行 Release 获取新的临时令牌并拉取。


## 运维互斥与拉取超时

手机号提供商切换与 Release 共用 `release-production` 并发组；服务器脚本另用 `/opt/steam-app/.deploy.lock` 互斥，防止手动执行或残留远端进程同时重建容器。Release 等锁默认 120 秒，可用 `DEPLOY_LOCK_TIMEOUT` 调整。

镜像每次拉取默认最多 180 秒，失败最多尝试 2 次，可通过 `IMAGE_PULL_TIMEOUT`（秒）和 `IMAGE_PULL_ATTEMPTS` 调整。拉取失败不切换服务、不写配置；日志记录每次尝试及退出码。这能限制网络卡住时的等待，但不能修复 GHCR 的网络连通问题。

仅修改独立 `ops-*` 工作流或手机号运维脚本不再触发镜像构建；混合应用变更、Release 配置变更、标签和手动发布仍构建。

手机号运维任务可选择 `legacy` 或 `supabase`，只重建主站并保持其实际运行镜像；失败恢复原 `.env.production` 和服务，恢复失败保留备份路径。选择 Supabase 需确认真实短信、老账号登录与新注册验收已通过；任务的健康检查只证明容器运行，不验证短信送达。
