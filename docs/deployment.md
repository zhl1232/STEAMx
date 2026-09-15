# 生产部署

GitHub Actions 的 Release Deploy 构建镜像并推送 `ghcr.io/zhl1232/steamx`，服务器按本次构建的 `sha256` 摘要拉取。SCP 仅用于 compose、部署脚本和 Nginx 配置，不再传输完整镜像压缩包。

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

部署先拉取精确镜像，再启动主站和后台 worker，等待健康检查。成功后将版本写入 `/opt/steam-app/.env` 的 `STEAM_APP_IMAGE`，保留其他配置，普通 `docker compose up -d` 会继续使用这个版本。

健康检查失败时，脚本尝试用部署前运行容器的本地镜像恢复两个服务，并让 Actions 标记失败。若恢复也失败，需查看服务器容器日志。发布不自动清理镜像，以保留恢复所需的层；后续按磁盘使用情况清理更早的版本。

如需人工查看当前版本：

```sh
cd /opt/steam-app
docker compose ps
docker inspect --format '{{.Config.Image}}' steam-app
```

令牌在 Actions 结束后失效；已拉取镜像仍可在本机使用。换服务器或清理本地镜像后，应重新运行 Release 获取新的临时令牌并拉取。
