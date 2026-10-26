# 生产部署

核对：2026-10-13，`0d322eda40dfdf81c7feb4f37703c9b38bea2b15`。本文维护应用构建、切换、恢复与运维互斥。数据库命令只在 [数据库连接与迁移](database-psql.md) 维护；模型资源发布见 [LDraw 发布](ldraw-publishing.md)。本次未核验生产运行状态。

## 触发与范围

触发授权统一遵守 [AGENTS.md 的 Actions 预算规则](../AGENTS.md#github-actions-预算与触发授权)。工作流不会检查用户是否授权：main push、`v*` 标签或手动 dispatch 都会触发 Release Deploy，所以必须在操作前守住授权边界。GitHub Actions 构建私有 GHCR 镜像，服务器按本次构建的 SHA-256 摘要拉取；创建 PR 不等于授权合并或发布。

Release 复用 `ci.yml`，检查与镜像构建并行，同一提交的两项均成功后才切换服务器。PR 有独立 CI，按下表分类。测试和镜像使用 Node.js 22；实际流程以对应提交的 `.github/workflows/release.yml`、`ci.yml` 和 `scripts/release-scope.mjs` 为准。

纯文档或允许的课程资源变更按范围规则跳过应用镜像和服务器切换，但纯文档仍运行 Release CI；本次另对严格首页展示变更启用 `home-ui` profile 和发布后语音 HEAD 检查；混合应用变更、Release 配置变化、标签及手动发布不能按纯文档处理。仅独立 `ops-*` 工作流或对应手机号运维脚本变化的处理也由范围脚本决定，不能推断任意配置文件均无需部署。

## CI 范围与成本

`ci.yml` 保留工作流名 `CI / PR Checks` 和 job 名 `test-and-lint`，草稿在 job 级跳过，不分配 runner；其他 PR 在同一个 job 内分类并运行范围策略测试；不使用顶层 `paths-ignore`，避免让 required check 无结果。纯文档轻量路径不安装应用依赖、不构建或启动浏览器，但 checkout 和策略测试仍消耗少量 runner 时间。草稿不执行这些轻量步骤，只留下 skipped run/check 记录。

| 事件与改动 | 本次实现的检查 |
|---|---|
| draft PR opened / synchronize / reopened / converted_to_draft | 整个 test-and-lint job skipped，不分配 runner、不执行分类或策略测试；不代表代码通过测试 |
| ready_for_review | 重新分类为 docs / home-ui / full；不沿用草稿绿灯 |
| 非草稿 opened / synchronize / reopened，仅命中严格文档白名单 | 分类 + 范围策略测试 |
| 非草稿严格首页展示改动（可混合白名单文档） | `home-ui`：核心检查保留，四项独立专项不运行，见下表 |
| 其他非草稿代码、工作流、依赖、SQL、脚本、测试、混合或未知路径 | 完整 PR 检查，含现有 build 和路由边界检查 |
| main push / v* tag / 手动 Release | 本次 SHA 上 CI：可信严格首页变更可 home-ui，其余 full；原镜像构建与部署范围规则保持；语音按下一表选择 |
| 事件不完整、比较异常/空结果、SHA 或 merge parents 不匹配 | 回退完整检查；脚本无法执行或策略测试失败则 job 失败，不能轻量放行 |

草稿 job skipped 可能满足 GitHub 的 required check 成功条件，但草稿本身不能合并。转 ready 后必须等待对应 SHA 的新运行完成，不把之前 skipped 当作通过；本次没有修改任何分支保护。`pull_request` 使用 PR 合并提交中的工作流，因此本次分支携带 job 条件时可在首次草稿创建生效，不必先更新 main。普通功能分支 push 不匹配现有 main/v* 发布触发；不要把“零 runner”描述成“没有 Actions 记录”。

文档白名单只包括 `AGENTS.md`、`README.md`、`PROJECT_INDEX.md`、`docs/README.md`、`docs/deployment.md` 的普通非可执行文件新增、修改或删除。其他 Markdown、docs 中的脚本/数据、符号链接、可执行位变化都不因此获豁免。分类用事件 base SHA 与实际 checkout 的合并 SHA 比较；检查两个 merge parents，与事件不符则全量。使用 NUL 分隔与禁用 rename 检测，避免路径换行、改名或删除代码漏检。实现与边界测试：`scripts/ci-scope.mjs`、`scripts/ci-scope.test.mjs`。

同一 PR 的后续事件取消该 PR 的旧运行；不同 PR 不互相取消。可复用 CI 的非 PR 调用按 run ID 隔离，不取消生产发布；Release 自身继续使用 `release-production` 和 `cancel-in-progress: false`。没有新增 PR 分支 push 工作流，也没有新增 cron。仓库现有工作流未配置 merge queue 事件，本次不更改队列设置；若将来启用 merge queue，必须先接入 `merge_group`，分类器对此保守 full。

节省来自草稿迭代不启动 runner、少数确定纯文档 PR、同 PR 过期运行取消，以及严格首页展示变更跳过独立专项、避免发布后语音冷下载，不承诺百分比。并行能缩短等待时间，不必然降低计费分钟。合并产生的新 SHA、不同配置或不同产物不能用旧 PR 绿灯替代；本次未引入跨运行结果缓存或扩大权限。

### 已实现的 home-ui 与发布语音分层

`home-ui` 同时适用于非草稿 PR 和具备可信部署基线的 main 发布；不是任何首页文件改动都可用。只允许两个已审查组件中现有的静态展示文字和字面量样式变化，且代码结构及导入依赖保持不变。没有重用旧版本测试结果。

| home-ui 检查 | 实际行为 |
|---|---|
| 范围/工作流契约、cleanup、lint、types、全部 unit、部署/DB/SEO 脚本测试、retained assets | 保留 |
| PR app build 与 production/development 路由边界 | 保留原 PR 行为；Release 继续由当次 Docker 构建把关，不增加 example.com 占位配置构建 |
| 原有 Run smoke E2E 整条命令 | 保留，包括 smoke、learning-guides、asset-cleanup、physics-lab 浏览器检查；没有任意删核心或首页相关用例 |
| 独立 portable physics lab（Node 测试） | home-ui 不运行；其他 full 仍运行 |
| project video presentation pilot | home-ui 不运行；其入口是项目页，不消费这两个首页组件 |
| immersive building layout | home-ui 不运行；独立 Vite fixture 装载搭建 UI，并非主站首页 |
| local Vosk engineering | home-ui 不运行；独立 Vite fixture/worker/model 工程测试，并非主站首页 |
| 两份专项证据上传 | 随对应专项跳过；summary 明确写 not run，不表示通过 |
| Release 镜像、部署预检/health、pending migration/allowlist、回滚、SEO | 保留；原 release-scope 不部署规则不变 |

共享 UI、全局样式、课程数据、播放器、语音资源、依赖/配置或测试变化都回 full。物理实验室浏览器 smoke 暂保留在原组合命令中，不把组合步骤耗时冒充已节省时间。

| 发布情况 | 发布后语音行为 |
|---|---|
| main push，仅有下列可验证展示变化及/或严格文档，且比较起点是紧邻、实际部署成功的 Release | health + 资源 HEAD；成功则省去 Chrome/依赖安装/约50.74 MB冷下载 |
| 上述轻量探针失败：状态、MIME、CORS、长度、网络或格式不确定 | 自动回退原完整语音探针；完整探针失败仍使发布失败 |
| 首页文件新增/删除/改名、任意未知/混合路径、共享组件、全局 CSS、认证/DB/依赖/Next/deploy/workflow/headers/SW 变化 | 原完整语音探针 |
| 首次 push、缺失/空/错误比较范围、SHA不一致、API失败、上次发布失败/未完成/无法确认 | 原完整语音探针 |
| v* tag 或手动 workflow_dispatch | 强制完整语音探针；可用于外部 CDN/OSS/环境配置变更后的明确获授权回归，无新增 cron |

首页白名单精确到 `components/home/home-showcase.tsx`、`components/home/mobile-shortcut-carousel.tsx` 的普通文件修改。`scripts/home-ui-scope.mjs` 固定两份已审查源码的 import preamble 哈希及展示归一化后的整文件哈希：仅现有 className/aria-label/alt/title 字面量和现有中文 JSX 文本节点可变化；导入、JSX 结构、链接、事件处理和程序逻辑变化均不匹配而回 full。另拒绝动态加载/求值、脚本嵌入、转导出及转义标识符；并非只靠关键词黑名单证明依赖安全。两端文件都要符合已审查形状，不能只因两端 import 相同就放行。源码调用点核对显示两者只在首页展示链中消费；它们引用的共享 UI、utils、brand、类别、鉴权等依赖**不在白名单**。`app/page.tsx` 涉及数据与 SEO，不放行。测试文件、资产、整个 home 目录或任意 UI 目录均没有被泛化放行。文档沿用上面的五个精确路径。

`scripts/release-voice-scope.mjs` 比较完整 push 的 before..after，而非只比较最后一条提交；禁用 rename、使用 NUL 及文件模式校验。只读 Actions 历史确认紧邻的前次 Release 是成功的 main push 且 SHA 等于 before，并核实最新 attempt 的 CI、build-image、deploy-production、verify-course-voice-loading 四个 job 都实际成功；整体绿但部署 skipped 的内容发布不算可靠基线。较旧成功、不同 SHA、PR、tag/manual 运行或前次失败均不能作为轻量范围起点。当前 run 被排除；历史读取不确定就全量。范围 job 输出 profile、before 与 verified SHA；可复用 CI 再核对 checkout SHA、完整差异及两端展示形状。跳过或失败发布不能被中间一次纯文档绿灯掩盖。这个基线只用于证明比较范围，不能替代当前 CI/构建/部署。范围 job 权限由原继承权限收窄为 contents/actions read。

`scripts/check-building-voice-headers.mjs` 只 GET `/api/health`，其他请求全为 HEAD（首页、worker/manifest/cache 脚本、CDN 及同源 fallback 两份大资源）。校验状态、脚本 MIME、CDN CORS 和资源长度，拒绝重定向，不读取模型正文。它不证明正文哈希或语音引擎功能，也无法穷尽无 Git 记录的远端配置漂移；这些变化应使用已有手动发布的 full 路径，仍需本次明确授权。轻量失败的 `continue-on-error` 只用于转入完整探针，不能吞掉完整检查失败。

更进一步的 UI→专项测试分层仍需逐模块维护影响映射。本轮只对严格 home-ui 跳过上述四项专项，其余代码发布仍保守 full，不泛化为任意 UI 改动或所有日常发布。

本地检查：`node --test scripts/ci-scope.test.mjs scripts/release-scope.test.mjs scripts/release-voice-scope.test.mjs scripts/check-building-voice-headers.test.mjs scripts/home-ui-scope.test.mjs scripts/ci-workflow-contract.test.mjs`，另用 actionlint 验证 workflow。GitHub 事件与 required-check 行为参考 [官方事件说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)。2026-10-26 只读查询可见 rulesets 为空；分支保护接口返回 403（集成缺少访问权限），所以不能确认 required-check 清单或保护是否启用。未修改远端设置；检查名称保持兼容但尚未远端验收。

### 全部发布检查的按需审查

以下是源码审查后的完整检查清单；除上文已实现的 PR、home-ui 和发布后语音分层外，其余“可按需”仍是后续建议，未删除测试。耗时取自 [2026-10-26 的既有 Release #421](https://github.com/zhl1232/STEAMx/actions/runs/40288433036) 的步骤起止时间，只读查询，不是截图推算或平均值，亦不是本次新 profile 的实测耗时。CI job 12分58秒；镜像 job 6分18秒与 CI 并行；部署 job 1分52秒；线上语音 job 2分47秒。各行时间不可直接相加当作发布总等待时间或计费额度。

| 检查 / 最近步骤耗时 | 目的与建议层级 | 直接影响与不能遗漏的间接影响 |
|---|---|---|
| CI scope 与策略测试（本次新增，未远端计时） | 每次分类必跑；异常全量 | 事件、差异、`scripts/ci-scope*`、workflow；不信任旧 SHA 结果 |
| repository cleanup safety / 2秒 | 保留便宜的静态保护；可列基础检查 | 退役脚本、被删资源、引用与维护文档；全仓引用与迁移边界也会影响 |
| lint / 2秒；types / 9秒 | types 保留基础检查；lint 很便宜，本轮无需为此复杂拆分 | app/components/hooks/lib/Scratch/config；共享类型、依赖、生成类型均影响 |
| unit / 2分52秒 | 建立映射后按模块；高风险或未知全量后备 | 被测模块与其调用者、共享工具、认证/积分/支付/DB、测试夹具及配置；不能仅凭测试文件名选择 |
| physics lab / 12秒 | 可按需专项 | `public/physics-lab/`、`tests/physics-lab/` 及对应入口；嵌入、路由、安全策略、依赖和测试工具变化也影响 |
| deploy/db-push/SEO 脚本测试 / 7秒 | 发布基础保护，廉价保留 | `deploy/`、`scripts/db-push*`、`scripts/check-seo*`、迁移、发布配置；镜像/运行环境变化也影响 |
| PR Build app；路由边界 / 此 Release 原本跳过 | PR 保留必要构建；路由安全边界不可随意省略 | app、proxy、`lib/development-only*`、Next 配置、环境开关、依赖；production/dev 三种配置都有关 |
| retained interface assets / 14秒 | 可按需专项 | `e2e/repository-cleanup-phase2.spec.ts` 覆盖的 UI/资源；共享布局、图片重写/优化、样式和缓存兼容也影响 |
| smoke E2E / 3分16秒（四份 spec 合计） | 核心可达性每次部署必保留；指引、资源兼容、物理专项可拆出按需 | `smoke.spec.ts` 自身还含游乐场和登录跳转等较多回归，并非极小冒烟；另含 learning-guides、asset-cleanup、physics-lab，需先明确哪些用例属于核心才能拆 |
| project video pilot / 50秒 | 可按需专项 | 项目视频组件、项目页、媒体数据/夹具；共享布局、播放器依赖、资源 URL 与 Next 配置也影响 |
| immersive building layout / 2分钟 | 可按需 3D 播放器专项 | `components/features/courses/` 搭建 UI、LDraw 解析/打包、课程模型与夹具；Three/WebGL、共享 UI/样式、动态加载、依赖升级也影响，课程数据不变不能保证播放器不变 |
| Vosk engineering / 2分39秒 | 可按需语音工程专项；声学真人验收不在当前 CI | building voice 控件/状态、`lib/courses/building-voice*`、Vosk worker/WASM/model/manifest、模型夹具；鉴权、缓存、资源路由、浏览器/依赖和共享播放器也影响 |
| 两份工程 evidence upload / 各1–2秒 | 跟随对应专项；保留失败证据 | 不应独立触发测试；轻量路径不上传 |
| release-scope / 步骤不足1秒，job 10秒 | 每次发布必做范围决策 | `scripts/release-scope*`；已允许的内容不构建镜像，但不是免除所有校验 |
| 镜像中的脚本预检 / 7秒；secrets / 1秒；磁盘 / 不足1秒 | 每次实际构建保留；磁盘不足才清理 | 发布脚本、凭据存在性、runner 空间；不能以之前成功代替当前前置条件 |
| Docker image build / 5分29秒 | 每次应用发布构建当次产物；正常层缓存可复用 | Dockerfile、依赖、Scratch、应用源码、构建参数；不复用旧 SHA 的通过状态 |
| Deploy on server / 1分02秒（含内部多项，未拆分计时） | 每次实际切换保留候选健康、Nginx 校验、迁移预检、切换健康/失败恢复 | 当次镜像和环境、Compose/Nginx、数据库待执行迁移与 allowlist；即使无新增迁移也不能凭源码差异取消 pending-migration 预检 |
| public SEO / 11秒 | 基础线上可达性保留；完整 SEO 扩展可按需 | robots/sitemap/页面元数据/公共路由；域名、Nginx、proxy、Next 配置、部署产物与内容数据也影响 |
| verify-course-voice-loading / 探针2分10秒，含安装等 job 2分47秒 | 已按上文严格白名单选择 headers/full 的**线上语音加载**专项，不是 3D 内容检查 | 语音 loader/worker/WASM/model/manifest、`scripts/check-building-voice-loading.mjs`、资源 URL 与签名/代理、CORS/CSP/缓存、CDN/OSS 域名、Docker/Nginx/部署环境/依赖；远端配置可能在无 Git diff 时变化，不能仅按课程数据目录判断 |
| SEO / voice 报告上传 / 各1秒 | 跟随对应探针保留证据 | 不代表独立业务验收或自动回滚 |

Checkout、Node/pnpm 初始化、依赖安装、Buildx/registry 登录、部署 bundle 传输和清理是上述检查/发布的执行成本，不是可随便删除的重复业务测试。此样本 CI 安装依赖4秒，语音 job 安装10秒；主耗时集中在单元和浏览器专项。多个 Playwright 配置各自启动服务器，相关重构可另行评估，但并行化不等于减少 runner 分钟。

线上语音探针的成本还包括外部资源读取：当前 manifest 的 model 为 44,934,262 字节、vosk.js 为 5,806,881 字节，合计 50,741,143 字节（约 50.74 MB），不含页面/worker 等其他请求。探针每次新建浏览器，cold 必须下载，warm 才验证不再请求；CDN 网络失败可回退同源，完整性失败不能回退。这是源码中的预期有效载荷，不是本次实测 CDN 账单。按需映射必须包含 loader、worker（以及将来若引入的 service worker）、resource-cache、manifest、headers/CORS/CSP、资源路径、CDN/OSS 与部署配置和依赖，不能只看课程模型。现有 release-scope 判为不部署的文档本来就不会进入该 job；本次新增的是两个精确首页展示文件满足基线条件时走 HEAD，不再冷下载。

对“课程基本不动”的结论：模型内容、3D 播放器、语音引擎、生产资源加载是四个不同影响面。真正无关的独立页面变更可以不跑后两类专项，但首先要有经过测试的独立路径白名单，并将共享依赖和远端环境未知纳入全量后备。本次语音选择不是仅按模型文件变化决定，而是严格首页展示白名单加发布基线、轻量在线检查与失败回退。没有执行真实生产探针验证这一新路径；部署配置漂移的限制见上文。

## 构建与缓存

Docker 的 `scratch-builder` 只接收 Scratch 子包及依赖输入，产物处于应用文件之前的独立镜像层；主站运行 `pnpm exec next build`。本地 `pnpm build` 仍同时构建 Scratch 和主站。

与源码同目录的测试仍参与 Next.js 类型检查；它们引用的夹具必须进入构建上下文。`.dockerignore` 为视频试点的 `__tests__/fixtures/project-video-pilot.json` 和家庭材料修订的四份 `household-source-*.json` 保留逐文件例外，其他独立测试目录继续排除。

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

`lib/courses/ldraw-review.ts` 静态读取的 `scripts/ldraw-production-protected.json` 必须进入 Docker 构建上下文；`.dockerignore` 仅对此保护清单放行，模型源稿和维护脚本仍排除。

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

生产部署成功后，`verify-course-voice-loading` 按上面的范围策略选择轻量 health/HEAD 或完整探针。完整探针使用启用沙箱的 Chromium 打开实际主站，在新浏览器上下文中验证冷下载、同源 Worker/WASM 模型初始化与热缓存复用，并区分 CDN 与原同源公开文件保底，保存 `building-voice-loading-<commit>` 工件。探针不登录、不申请麦克风、不执行课程动作；不能代表手机、真人口令或投屏验收。`passed`只表示加载可用，另以`cdnReady`记录CDN迁移是否完成。探针失败会标记 Release 失败，但不自动回滚已部署应用，需要核对部署步骤和线上状态后处理。可用 `node scripts/check-building-voice-loading.mjs` 单独复核，浏览器必须具备正常沙箱和有效证书链。
