# 生产部署

核对：2026-10-13，`0d322eda40dfdf81c7feb4f37703c9b38bea2b15`。本文维护应用构建、切换、恢复与运维互斥。数据库命令只在 [数据库连接与迁移](database-psql.md) 维护；模型资源发布见 [LDraw 发布](ldraw-publishing.md)。本次未核验生产运行状态。

## 触发与范围

触发授权统一遵守 [AGENTS.md 的 Actions 预算规则](../AGENTS.md#github-actions-预算与触发授权)。工作流不会检查用户是否授权：main push、`v*` 标签或手动 dispatch 都会触发 Release Deploy，所以必须在操作前守住授权边界。GitHub Actions 构建私有 GHCR 镜像，并尽量把同一 digest 的归档镜像到杭州 OSS；服务器优先用 OSS 签名包加载该摘要，失败再回退 GHCR 拉取。创建 PR 不等于授权合并或发布。

Release 复用 `ci.yml`，检查与镜像构建并行，同一提交的两项均成功后才切换服务器。PR 有独立 CI，按下表分类。测试和镜像使用 Node.js 22；实际流程以对应提交的 `.github/workflows/release.yml`、`ci.yml` 和 `scripts/release-scope.mjs` 为准。

纯文档或允许的课程资源变更按范围规则跳过应用镜像和服务器切换，但纯文档仍运行 Release CI；应用变更保留基础检查，并按经过核验的影响范围选择独立专项及发布后语音 HEAD/full；混合应用变更、Release 配置变化、标签及手动发布不能按纯文档处理。仅独立 `ops-*` 工作流或对应手机号运维脚本变化的处理也由范围脚本决定，不能推断任意配置文件均无需部署。

## CI 范围与成本

`ci.yml` 保留工作流名 `CI / PR Checks` 和必需检查入口 `test-and-lint`。草稿 PR 在 job 级跳过，不分配 runner；转为 ready 后重新分类。没有用 `paths-ignore`、`pull_request_target`、跳过提交标记或旧提交的绿灯替代当前提交检查。

### 基础检查和专项选择

`scripts/ci-scope.mjs` 继续区分精确文档白名单、经过指纹核验的 home-ui 与其他应用变更。文档白名单仅有 `AGENTS.md`、`README.md`、`PROJECT_INDEX.md`、`docs/README.md`、`docs/deployment.md` 的普通文件；不能因 `.md` 后缀或位于 `docs/` 就跳过基础检查。home-ui 的两份首页组件仍要求导入及展示结构指纹匹配，不扩展为任意 UI 白名单。

| 检查 | 执行范围 |
|---|---|
| 范围策略及工作流契约 | 所有实际启动的 CI job |
| 清理保护、依赖安装、lint、types、部署/迁移/SEO/worker 脚本测试 | home-ui 和其他应用变更均保留 |
| Vitest 单元测试 | main Release 全量；PR 对已核验的独立模块修改使用真实依赖图、模块测试与全局源码契约的并集，其余全量 |
| PR app build、production/dev 路由边界 | 应用 PR 保留；Release 由当前 SHA 的 Docker 构建把关 |
| 核心 smoke、学习指南、旧 logo 兼容、现用界面资源 | 健康、登录与认证核心保留；细节标签和指南/资源 spec 按核验范围选择，同一次 Playwright 调用复用 Next dev 服务 |
| 物理实验室 Node 及浏览器测试 | `physics` 专项被选中时运行；浏览器 spec 加入上述同一次调用 |
| 项目视频、沉浸搭建、Vosk 语音工程 | 分别由 `project-video`、`building`、`voice` 决定 |
| 搭建、语音证据上传 | 跟随对应专项，保留失败证据 |

`scripts/ci-test-impact.mjs` 维护专项和基础浏览器依赖归属，`scripts/ci-test-plan.mjs` 负责可信比较范围与输出，`scripts/ci-unit-tests.mjs` 执行 PR 单测选择。是否运行专项与基础检查的 `full/home-ui` 模式分开：`full` 不再表示无条件启动全部浏览器夹具。未运行的专项在 summary 明确标记 `not run`，不记为测试通过；工作流只有收到显式 `false` 才跳过，缺失输出按需要运行处理。

PR 单测仅对已审查的客服、商城、硬币商城和项目模块中既有 TS/TSX 普通文件修改缩小范围。使用安装版本 Vitest 的反向依赖图，合并模块全部测试、变更测试和全局内部链接/页面标题源码扫描；不使用 `--passWithNoTests`。新增、删除、重命名、数据文件、共享代码、配置及未知路径，或图解析失败、模块无测试、发现结果不完整时，在执行前回退全量。真正的测试失败直接失败，不再另跑全量掩盖或重试。

浏览器细节用显式标签区分首页、游乐场、自然及其他专题；未标记的新用例仍属于核心检查，不会被默认排除。独立客服改动不运行游乐场交互和首页多尺寸细节；商城/项目保留首页依赖检查，项目模块还保留使用其科学项目数据的学习指南。生产构建与生产/开发访问边界仍保留，不从类型检查成功推断打包或路由安全已通过。

| 变更归属 | 专项选择 |
|---|---|
| 物理实验室页面、状态 API、hooks、模拟资源及其测试 | 物理实验室 |
| 项目详情、视频呈现、项目映射、作者头像、项目页依赖的商城组件/数据与视频夹具 | 项目视频 |
| 搭建播放器、课程/LDraw 共享依赖、模型和共享夹具 | 沉浸搭建 + 语音工程 |
| 语音控件、Vosk worker/model/cache、音频会话及语音夹具 | 语音工程 |
| 已核对独立的客服模块、商城路由、指定页脚/账号菜单组件、明确列出的专题文档 | 保留基础检查，不运行上述独立专项 |
| 全局布局/样式、共享 UI/工具、鉴权、依赖、配置、工作流、未知路径或异常文件模式 | 所有专项 |

混合变更取并集；出现未知或共享路径时直接全量。映射不是任意目录豁免，精确文件和目录以脚本为准。新增模块或改变跨模块依赖时，应同时更新映射及回归用例；不能仅凭页面名称推断它与专项无关。默认声学真人验收继续使用手动流程，CI Vosk 工程只验证 worker/WASM/cache/麦克风生命周期等工程行为。

### 比较范围与失败回退

PR 必须核对当前 checkout SHA 和两个 synthetic merge parents，比较完整 base..merge；草稿、未知事件、错误 parents、解析失败均不能得到缩小的专项计划。main push 比较事件的完整 before..after，核对 checkout 与祖先关系，不只看最后一条提交。

main 缩小专项前还需只读核验 **before 精确 SHA 对应的最新 Release CI job** 已实际成功。只检查该次最新 attempt 的 `ci / test-and-lint`，不沿用较旧 SHA 或旧 attempt 的成功。CI 后面的部署失败/取消不改变该源码已通过 CI 的事实；CI 本身失败、取消、跳过、未完成，API/凭据/分页不完整或无法核对范围时，一律运行全部专项。这个基线只用于确定影响范围，当前提交仍执行自己的基础检查、所选专项和镜像构建。可复用 CI 与调用方仅增加 `actions: read` 以读取基线。

tag、手动发布、未知事件及不可靠范围默认全量。相同 PR 的新检查取消其旧检查；不同 PR 和生产发布的既有互斥不变。没有新增定时任务，也不因本地测试通过自动触发远端 Actions。

### 构建与浏览器夹具

PR build 使用 `http://127.0.0.1:54329` 的 `e2e/store-integration/data-server.mjs` 匿名公共空内容夹具。启动后有界等待并校验 HTTP 200 与 JSON `[]`；夹具不支持认证或写入。它保留到 production/development 路由边界检查结束，随后无论成败仅按记录 PID 清理。Release 镜像仍使用当次真实构建配置，空内容夹具不代表真实业务验收。

默认 Playwright 只启动一次，执行核心 smoke，按范围追加学习指南、资源兼容、现用资源及物理 spec；缺少明确的选择结果时完整执行。独立视频、搭建和语音夹具仅在选中时启动；它们有不同的浏览器集成目标，不能视为同一测试重复运行。没有删除登录、生产路由边界、管理员校验、支付事务或迁移保护来节省分钟。

交互 smoke 通过匿名页面浏览记录等待现有客户端初始化完成，再操作搜索框和原生折叠菜单；登录引导用例也等待真实页面记录，替代固定睡眠。链接跳转使用导航等待，仍受原有测试时限约束，不能把 SSR 内容可见当成客户端事件已绑定。

历史旧素材、编辑器目录和旧文档快照的清理结果由 Git 历史留存，不再每次发布断言它们仍不存在。旧 Vosk v1 缓存单测退役，其中仍适用的并发去重及缓存不可用用例已转到当前 v2 单测；v1 静态资源继续保留，保障旧客户端缓存兼容。清理入口的拒绝执行与现用资源/迁移保护仍在基础检查内。

### 发布后的语音检查

`scripts/release-voice-scope.mjs` 使用同一专项归属判断：已审查的无语音影响模块可以使用 health + 资源 HEAD；语音/共享/未知变更仍走完整冷加载。首页展示变更继续核对原有源码指纹。

缩小线上语音检查的基线比 CI 专项更严格：紧邻的前次 main Release 必须 SHA 等于 before，且最新 attempt 的 CI、build-image、deploy-production、verify-course-voice-loading 全部实际成功。整体绿但部署 skipped 的内容发布、失败/取消的部署、较旧成功或 API 不确定均不能作为已部署基线。

HEAD 探针仅 GET `/api/health`，对首页、worker/manifest/cache 脚本、CDN 与同源 fallback 资源发 HEAD，校验状态、MIME、CORS 和长度，不下载模型正文。任何不确定都会回退完整语音加载；`continue-on-error` 只用于进入该回退，不吞掉完整检查失败。无 Git 记录的 CDN、OSS、环境配置变更仍需通过明确获授权的手动 full 路径验收。

### 本地验证与耗时证据

范围与接线验证：`node --test scripts/ci-scope.test.mjs scripts/ci-test-impact.test.mjs scripts/ci-test-plan.test.mjs scripts/ci-unit-tests.test.mjs scripts/release-scope.test.mjs scripts/release-voice-scope.test.mjs scripts/check-building-voice-headers.test.mjs scripts/home-ui-scope.test.mjs scripts/ci-workflow-contract.test.mjs`，另用 actionlint 检查工作流。单元测试中的 GitHub 请求使用本地替身，不发真实 API 请求；工作流契约还直接执行 smoke 参数组装，验证只启动一次且缺失选择结果时包含物理专项。

历史 [Release #421](https://github.com/zhl1232/STEAMx/actions/runs/40288433036) 的 CI 为 12分58秒：unit 约2分52秒、组合 smoke 3分16秒、视频50秒、搭建2分钟、Vosk 2分39秒，而 lint/types/脚本保护只有秒级。该记录说明优先按模块减少重型浏览器工作的依据，不是新规则的实测速度，也不是发布时长承诺。镜像构建、服务器切换与生产互斥仍有自身成本，不能把跳过专项直接等同于固定总耗时。

## 构建与缓存

Docker 的 `scratch-builder` 只接收 Scratch 子包及依赖输入，产物处于应用文件之前的独立镜像层；主站运行 `pnpm exec next build`。本地 `pnpm build` 仍同时构建 Scratch 和主站。

与源码同目录的测试仍参与 Next.js 类型检查；它们引用的夹具必须进入构建上下文。`.dockerignore` 为视频试点的 `__tests__/fixtures/project-video-pilot.json` 和家庭材料修订的四份 `household-source-*.json` 保留逐文件例外，其他独立测试目录继续排除。

首次构建、锁文件或 Scratch 源码/配置变更、基础镜像变化及缓存失效时仍需重建。Actions 缓存用于编译复用，服务器 Docker 缓存用于只下载缺失层，不能保证每次都会命中。

构建前磁盘空间低于 20 GiB 才触发清理 Android、.NET、Haskell 等预装内容，保留工具缓存里的 Node。此阈值不代表实际构建空间或提速承诺。

## 凭据和前置条件

服务器连接复用现有 `SERVER_HOST`、`SERVER_USER`、`SSH_PRIVATE_KEY` 和可选 `SERVER_PORT`。GHCR 使用当次 Actions 的 `GITHUB_TOKEN` 与 `packages: write` 权限；同名包需允许该仓库访问，不新增长期仓库密码或把镜像改为公开。

### 生产镜像的 OSS 旁路（优先国内拉取）

北京 ECS 从 GHCR 拉大镜像经常偏慢。Release 在镜像推到 GHCR 后，额外把**同一 digest** 的 gzip 归档上传到已有杭州 OSS 桶，部署时优先用短期签名 URL 下载再 `docker load`；失败才回退现有 GHCR 拉取（总预算 900 秒、最多 4 次）。拉不下来时应用和配置都不改。

| 项 | 值 |
|---|---|
| 桶 | `steamx`（杭州 `oss-cn-hangzhou`） |
| 对象路径 | `deploy/steamx/sha256-<64位十六进制>.tar.gz` |
| 元数据旁路 | 同名 `.json`（digest、git SHA、大小、上传时间）；**仅便于核对，不是删除依据的唯一来源** |
| CI 上传 | `scripts/upload-deploy-image-to-oss.mjs`（`docker pull` → `docker save \| gzip` → `ali-oss` multipart） |
| 服务器下载 | `IMAGE_OSS_URL`（CI 生成、默认 7200 秒有效的签名 GET）；`curl` 下载后 `gunzip \| docker load` |
| 回退 | OSS 未配置、签名缺失、下载/load 失败或 load 后仍无目标 digest → 现有 GHCR `docker pull` |

GitHub **production** 环境需要（与素材用的 `ALIYUN_OSS_*` 分开，避免混用主账号或素材权限）：

| 名称 | 类型 | 说明 |
|---|---|---|
| `DEPLOY_OSS_ACCESS_KEY_ID` | Secret | 独立 RAM 子账号 AccessKey ID |
| `DEPLOY_OSS_ACCESS_KEY_SECRET` | Secret | 对应 Secret；**不要用主账号 AK** |
| `DEPLOY_OSS_BUCKET` | Variable（可选） | 默认 `steamx` |
| `DEPLOY_OSS_REGION` | Variable（可选） | 默认 `oss-cn-hangzhou` |
| `DEPLOY_OSS_ENDPOINT` | Variable（可选） | 需要时覆盖 region 推导的 endpoint |
| `DEPLOY_OSS_PREFIX` | Variable（可选） | 默认 `deploy/steamx` |
| `DEPLOY_OSS_SIGN_EXPIRES` | Variable（可选） | 签名 URL 秒数，默认 `7200` |

RAM 建议：只给该桶 `deploy/steamx/*` 的 `oss:PutObject` / `oss:InitiateMultipartUpload` / `oss:UploadPart` / `oss:CompleteMultipartUpload` / `oss:AbortMultipartUpload` / `oss:GetObject` / `oss:HeadObject` / `oss:ListObjects`（List 仅清理方案需要）。桶内该前缀保持私有，不靠公共读。未配置上述 Secret 时上传步骤会跳过，发布仍只走 GHCR，便于合入后由运维补齐密钥。

#### OSS 发布包清理（仅提案，本仓库不自动删）

不要「单纯按 7 天一到就删光」。正确逻辑：

1. 只考虑 `deploy/steamx/sha256-*.tar.gz`（及其同名 `.json`）这类发布包。
2. **硬底线：至少保留最近 2 个包**（按 Last-Modified / 上传时间从新到旧）。少于等于 2 个时一律不删。
3. 在已满足「至少 2 个」的前提下，仅当桶里**已经存在更新的发布包**时，才允许删除**超过 7 天**的旧包；若长期未发版，最新那份即使超过 7 天也必须保留，不能被误删。
4. 清理须显式获授权、先 dry-run 列出将删对象，再执行；本 PR / 工作流**不静默删除、不自动执行删除**。

运行时配置由服务器 `/opt/steam-app/.env.production` 提供。本地同名文件不会自动上传。服务器须能连接 GHCR（作回退）或通过签名 URL 访问 OSS；Compose 须支持 `up --wait --wait-timeout`；令牌失效后已有本地镜像可继续使用，换服务器或删除本地镜像需通过获授权发布重新取得可用拉取凭证。

## 发布事务与恢复边界

1. 取得精确 digest 的镜像（优先 OSS 归档 `docker load`，失败再 GHCR `docker pull`），以生产配置启动不发布端口、不运行 worker 的候选容器，检查 `/api/health` 后移除。健康检查只证明进程启动，不证明计费、ASR 或数据库业务正确。
2. 备份并安装候选 Compose、Nginx 配置和启用链接，校验 Nginx；通过后执行本次获批准的限定迁移。
3. 迁移成功后切换主站和 worker，等待健康检查并 reload Nginx。成功才将 `STEAM_APP_IMAGE` 写入服务器 `.env`，保留其他配置。
4. 失败时按脚本恢复原配置；已尝试切换容器时使用部署前实际镜像和原 Compose 恢复，并通过同一 Compose 项目的 `up --remove-orphans` 清理新版本新增、旧配置未定义的 worker 等容器，Actions 标记失败。恢复失败保留备份路径，先修复配置/容器，不盲目重跑。

部署 bundle 使用 run/attempt 专属临时目录，完成后清理。发布不自动清空旧镜像，保留恢复所需层。

**容器回滚不等于数据库或业务回滚。** 已提交迁移不会被部署脚本反向修改；旧计费应用可能无法新建旧凭证。迁移后切换失败，应发布兼容已提交结构的应用，不伪造未执行标记、不删减用户账本。

`lib/courses/ldraw-review.ts` 静态读取的 `scripts/ldraw-production-protected.json` 必须进入 Docker 构建上下文；`.dockerignore` 仅对此保护清单放行，模型源稿和维护脚本仍排除。

## 数据库与应用版本协调

Release 的 `MIGRATION_ALLOWLIST` 是该提交的批准文件清单。通用指南不写死“本次三条”；[2026-10-13 配置快照](releases/2026-10-13/runtime-migrations.md) 保存本轮核对结果。新增迁移必须另行审查并更新允许名单，不取消范围校验放行。

部署包必须携带完整迁移目录。限定预检要求已有追踪表，发现名单外待执行项会在写入前失败；命令、副作用、事务及首次接入规则统一见 [数据库连接与迁移](database-psql.md)。

生产精简镜像直接以 Node 执行项目自定义迁移脚本，不下载新依赖或使用官方 Supabase CLI。候选与迁移沿用 `docker compose run --no-deps`、既有环境文件和只读脚本/SQL 挂载。应用预检和 Nginx 校验失败时不执行迁移。

## 互斥、超时和手机号运维

Release 与手机号提供商运维共用 `release-production` 并发组，服务器另以 `.deploy.lock` 互斥。默认锁等待 120 秒；镜像获取总预算 900 秒（OSS 下载+load 与 GHCR 拉取共用，不再按单次 180 秒掐断）、GHCR 最多 4 次尝试、失败后退避 10/20/40 秒，过程中每 30 秒打印一次进度心跳，分别由 `DEPLOY_LOCK_TIMEOUT`、`IMAGE_PULL_TIMEOUT`、`IMAGE_PULL_ATTEMPTS`、`IMAGE_PULL_BACKOFF_SECONDS`、`IMAGE_PULL_HEARTBEAT_SECONDS` 调整。优先走 OSS 签名包；OSS 失败再回退 GHCR。获取失败时应用和配置都不改。

候选预检默认最多 20 次、间隔 2 秒，每次 HTTP 请求最多 4 秒；相关变量为 `PREFLIGHT_ATTEMPTS`、`PREFLIGHT_INTERVAL_SECONDS`。超时限制不能修复网络问题。

手机号运维只重建主站并保持其实际镜像；失败恢复环境文件和服务，恢复失败保留备份。认证切换的准入和真实短信验收只在 [登录与短信](phone-auth.md) 维护，容器健康不能代替短信送达。

## 商城与客服任务

`commerce-worker` 与应用使用同一镜像，等待应用健康后运行 `deploy/commerce-worker.mjs`。以 `CRON_SECRET` 或 `INTERNAL_API_SECRET` 认证，每分钟独立调用订单对账和客服通知接口；单个任务失败不阻止另一个，下次循环须等本次结束。请求有界超时，退出信号停止新一轮任务；错误日志不打印 webhook 或密钥。

启用飞书应用模式时，同一 worker 还启动 `deploy/feishu-bridge.mjs` 的 SDK 长连接，以及独立的收发队列循环；它们不阻塞原对账任务。收到的群聊文字、图片与富文本只转发白名单字段到内部认证接口，必须先持久入队才确认接收；退出时关闭长连接、心跳和重连计时器。飞书 SDK 的原始事件日志保持关闭。配置与接入权限统一见 [客服专题](customer-support.md#飞书应用机器人与直接回复)。

飞书 SDK 由 worker 在 Next 服务入口之外加载。Docker 构建完成后执行 `scripts/prepare-feishu-runtime.mjs`，使用项目固定版本 Next 自带的文件追踪器，将 SDK 及其依赖补入 standalone 目录并验证可加载；不能只复制 SDK 单个包而遗漏传递依赖。

客服通知缺少配置时保留队列但不外发，变量见 [站内官方客服](customer-support.md)；订单查单仍可处理历史交易，不以新购开关关闭为依据丢弃在途交易。worker 的 Compose/Docker 配置已在本地实现，未启动生产任务或发送真实提醒。发布前需把获批准的商城、客服、报价及草稿迁移与其他待执行迁移一同核对允许名单，不能只更新容器而遗漏数据库。

## 部署后的独立检查

SEO 检查在切换后运行；失败可标记 Release 失败并跳过主动推送，但不会自动回滚已经部署的应用，处理见 [SEO 日常运营](seo-daily-operations.md)。

每次发布分别记录代码提交、镜像摘要、迁移结果、应用健康和实际业务检查。没有检查对应数据或真实功能时写“未核验”，不从 workflow 成功推定用户余额、供应商连通或课程体验全部通过。

生产部署成功后，`verify-course-voice-loading` 按上面的范围策略选择轻量 health/HEAD 或完整探针。完整探针使用启用沙箱的 Chromium 打开实际主站，在新浏览器上下文中验证冷下载、同源 Worker/WASM 模型初始化与热缓存复用，并区分 CDN 与原同源公开文件保底，保存 `building-voice-loading-<commit>` 工件。探针不登录、不申请麦克风、不执行课程动作；不能代表手机、真人口令或投屏验收。`passed`只表示加载可用，另以`cdnReady`记录CDN迁移是否完成。探针失败会标记 Release 失败，但不自动回滚已部署应用，需要核对部署步骤和线上状态后处理。可用 `node scripts/check-building-voice-loading.mjs` 单独复核，浏览器必须具备正常沙箱和有效证书链。
