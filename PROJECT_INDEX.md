# STEAM 探索 — 项目功能索引

> 本文档为 AI 阅读代码时的导航索引。按功能模块组织，标注每个模块的职责与关键文件位置。
>
> 开发约定：
> - AI/自动化工具开始改动前，先阅读本文档对应模块；不确定文件归属时，先补充索引再改代码。
> - 新增功能、新路由、共享模块、脚本、数据库结构或重要行为变更时，同步更新本文档。
> - 本项目使用 Next.js 16，根级请求拦截入口必须使用 `proxy.ts` 并导出 `proxy`；不要新建或恢复已废弃的 `middleware.ts`。

---

## 1. 页面路由 (`app/`)

| 路由 | 入口文件 | 功能说明 |
|------|----------|----------|
| `/` | `app/page.tsx` | 首页 — Hero 明确「探索项目 / 进入创造营」双 CTA，紧凑的「从这里开始」分类入口承接新用户行动；主体不再重复探索页热门项目，改为统一作品「大家的新作品」与最近公开观察「自然新发现」，桌面双栏、移动端顺序滚动；继续保留移动端自然观察/排行榜快捷入口、桌面社区动态与本周挑战（挑战卡读取当前 `active` PBL，优先限时挑战，卡片进入 `/pbl/[id]`，「查看全部」进入 `/create?tab=pbl`，无挑战时回退创造营 PBL Tab） |
| `/explore` | `app/explore/page.tsx` | 探索页 — 专注项目发现，项目列表默认「热门推荐」，并提供「最新上架」「新手推荐」，支持搜索、分类/子分类筛选；移动端项目网格使用左右对称的页面 gutter；项目卡不再查询或展示已停用的项目评论数，统一展示项目点赞、公开终稿作品数和投币三个互补指标，其中作品数通过批量 RPC 获取，避免逐卡查询；作品预览已移到首页，不在此重复展示；自然观察列表/物种图鉴规范入口为 `/nature/observations`、`/nature/species`，旧 `/explore/observations`、`/explore/species` 及详情地址由 `next.config.mjs` 直接永久重定向并保留查询参数，对应的旧页面壳已删除 |
| `/project/[id]` | `app/project/[id]/page.tsx` | 项目详情 — 步骤、材料清单、点赞/收藏、作品与探索记录、打赏、项目举报；不再提供项目评论，留言、提问和建议统一进入具体作品；项目详情预览中的最终作品卡直接进入作品详情并显示「查看作品并留言」，没有作品时引导先上传；探索记录空状态只保留记录说明与一次主行动，有记录时才显示「查看全部探索记录」；「全部探索记录」页按 `exploration_id` 将同次探索合并为堆叠卡片，每组只加载一张代表图并汇总步骤/互动数，顶部类型筛选收拢为带语义标签的轻量工具栏，默认按最新动态展示并取消无效的排序 Tab；记录类型筛选只隐藏展示帖子但保留终稿状态，超过 48 条时明确标注当前列表统计；完成组优先进入终稿，未完成组也可从最新步骤进入完整探索详情，作者可继续选择任一步作为完成作品；移动端顶部操作区为已登录的非作者提供举报入口，桌面端项目操作移到详情头部；项目分享入口按需加载与作品相同的高清分享卡片，使用项目图、作者、二维码和 `/project/[id]` 规范链接，并支持系统分享、保存图片和复制链接；历史课程背书项目会重定向到对应课时作品区 |
| `/works/[id]` | `app/works/[id]/page.tsx` | 统一作品/探索详情 — 展示项目完成作品、尚未设终稿的项目探索或课程课时作品的媒体、来源、作者、点赞、留言与提问、打赏；项目记录按 `exploration_id` 将同次探索的公开审核记录按时间串成过程时间线，即使没有终稿也可进入详情；详情时间线最多展示最近 50 条，并在截断时显示完整记录总数；无 `exploration_id` 的历史记录只展示当前记录，避免串入同项目其他探索；未完成探索的作者可在任一步使用「把这一步设为完成作品」，原子完成终稿标记、奖励和探索状态更新，无需重新上传；作为项目相关留言、问题和建议的统一入口，作品评论和回复都可单独举报（仅登录用户可举报他人内容），举报使用次级图标入口，回复的「@对象」与作者名保持同一行；课程作品返回文案为「返回课程课时」并可回到对应课时；项目作品返回文案为「返回探索记录」；无来源时显示「返回探索」；点赞与投币紧凑排列在作者信息同一行，已投币作品显示琥珀色选中态，不再提供评论计数快捷按钮，没有创作说明时整段隐藏；仅完成作品作者可使用分享入口和 `?share=1` 自动打开能力，入口按需加载 `modern-screenshot` + `qrcode.react`，生成带作品主图、作者/来源和链接二维码的 750×1000 PNG 卡片，支持系统分享（移动端可选择微信）、保存图片和复制链接；项目、课程等公共内容仍由各自详情页开放分享；作品主图与探索时间线照片改为满宽预览，点击进入全屏看图（左右滑动、双指缩放、双击放大、下滑关闭），不再把小缩略图当作唯一查看方式 |
| `/community` | `app/community/page.tsx` | 社区 — 讨论列表、发帖；子路由 `challenge/`（挑战详情）、`discussion/`（帖子详情） |
| `/nature` | `app/nature/page.tsx` | 自然观察首页 — Hero 下方专题分类（鸟类/昆虫/植物/真菌；各专题入口卡使用 `public/assets/nature-topic-*.webp` 独立背景图，左侧留白叠文字、右侧为主体插画；植物专题覆盖树木与水果干果），其后为最近观察地图流（观察记录列表按发布时间 `created_at` 倒序）；桌面端侧栏保留社区贡献与观察概览，移动端在地图流下方以紧凑四格统计条展示社区贡献；地图预览与选点器统一使用本站打包的 Leaflet + 国内高德栅格瓦片，支持移动端双指缩放、惯性拖动、桌面滚轮/双击缩放和键盘操作，热点弹窗、列表联动及可拖拽选点保持业务定制；专题卡补充图鉴总数与当前用户点亮进度，点亮口径与物种图鉴共用本人 RPC；子路由 `observations/`（列表按发布时间倒序，移动端扁平卡片流并隐藏全局 AI FAB 避免遮挡内容）、`observations/[id]/`（详情：已通过记录显示社群共识条 + 动态时间轴 + 物种比较 Bottom Sheet + 底部评论/建议鉴定，可选补充生命阶段与性别；`from` 允许站内相对路径含首页 `/`，拒绝 `//` 与 `..` 穿越；缺失记录在 generateMetadata 即 `notFound()`；共识确认后仍可继续认同或提交不同鉴定；待审/拒绝记录仅作者可见审核状态；`...` 菜单含删除/举报）、`species/`（全量物种图鉴矩阵：固定专题/名称顺序，客户端过滤 `q/topic/status`，已观察彩色、未观察/匿名灰度、仅缺图问号；匿名登录回跳保留当前 `q/topic/status`；专题页按中文拼音首字母分组并提供右侧索引，移动端三列 4:3 缩略卡；按实际渲染顺序（专题视图为首字母分组后的顺序）取前 3 张缩略图使用 priority 预加载，其余保持懒加载；全部视图保留专题分组，专题视图隐藏重复分组标题；卡片进入公开物种详情，详情轮播合并公开观察照片并显示观察者昵称及观察记录链接；热点地图不再重复渲染地点列表，marker 弹窗展示匹配观察的首张照片、观察者和观察记录链接；观测统计中的观察/鉴定用户排行默认折叠并可展开；返回通过 `lib/nature-species-scroll-restore.ts` 的 v2 锚点恢复视口）、`submit/`（相册可多选；每张照片单独成为一条观察，按张鉴定物种/性别/阶段与地点；无 GPS 才必填，可显式套用到其余未定位照片；主流程无描述；公开准确位置需显式确认）、`map/` |
| `/playground` | `app/playground/page.tsx` + `layout.tsx` | 益智游乐场 — 18 个互动游戏（2048、24点、五子棋、扫雷、汉诺塔、数独、N皇后、生命游戏默认挑战、数字华容道、记忆翻牌（萌宠/自然/宇宙/美食/科学五套图案可选与 3D 翻牌）、速算闪电战、迷宫探险、七巧板、数织、球排序、天平称重、像素对称、函数战争）；在线能力覆盖五子棋实时对弈、记忆翻牌实时对战、函数战争回合制 1v1、扫雷云端榜单，以及 24 点/速算/汉诺塔/N 皇后/数字华容道/数织/球排序/天平/像素对称/七巧板通用竞速房间（6 位邀请码、邀请链接、共享牌面/初始棋盘或固定关卡，双方成绩提交后判胜负）；球排序扩展为 10 关，后段提升到 6-8 色复杂周转，并采用实验台式试管架，包含选中上浮、可倒目标提示、无效轻震与倒球/落球动效，移动端保持稳定触控尺寸并隐藏小迪悬浮入口避免遮挡高级关试管；天平称重采用实体天平盘面、当前投放托盘分段控件、硬币台一键入盘/移除、称量合法性提示、结果倾斜反馈、通关结果条和称量记录，移动端隐藏小迪悬浮入口以优先露出盘面；像素对称改为半图镜像挑战，样本半边锁定、挑战半边手动补图，提供误点、步数、连击、星级与最佳成绩反馈，并扩展到左右/上下 10 关；数织 28 关（3×3 至 15×15），含船锚/蘑菇/螃蟹/幽灵/外星/骷髅/火箭/猫头鹰/小龙/神殿/飞船/火鸟/迷宫/星系等进阶图案，须按顺序解锁；通关后以答案轮廓生成清晰的分层像素作品（主题配色、边缘明暗、少量关卡细节），替代被剪影切碎的细腻 SVG，并用紧凑收藏结果条展示作品名、用时、失误与下一关；数织移动端点格不再聚焦滚动，线索栏加宽并 sticky，避免行列提示数字被顶栏或格子盖住；生命游戏默认进入关卡挑战，强调细胞预算、演化代数、三星条件与挑战完成口径，不再把单纯运行次数当胜利；迷宫页只保留俯视迷雾探索地图，移除体验不佳的沉浸视角；方向键、WASD 与手机紧贴地图的四向箭头统一为地图绝对上下左右，撞墙时只转向并给出反馈，移动端确保地图和箭头在同一屏内；探索地图用高对比探险者朝向、手电视野、当前可见区/历史记忆区、足迹与迷雾揭开强化方向感和探索感，闯关中继续隐藏理论最短步数与全图，通关后隐藏方向控制、揭图并在地图区上移展示 BFS / DFS / A* 探索对比与回放；`layout.tsx` 统一 `surface-panel` / `--tone-*` 侧栏与本局提示条，并为全部小游戏在移动端顶栏提供统一玩法说明入口（目标、操作、快捷方式、挑战目标）；移动端游戏内页保留紧凑顶栏并隐藏横向全游戏导航/本局提示以优先露出游戏本体，且移动端去掉 playground 外层 `app-shell-wide` 横向 gutter，由各游戏页自行保留触控安全边距，避免 `100dvw` 游戏区被父级裁切；扫雷页桌面端采用更清爽的单行控制台、轻量棋盘舞台和低遮挡胜负结果浮层，普通桌面收窄右侧课程面板以增加主游戏区宽度；游乐场用户可见战绩口径统一为云端/在线记录，登录后由 `playground_stats` 同步；移动/平板工具栏持续到 `lg` 断点，游戏区在手机端使用居中的 `100dvw` 容器突破通用 gutter，不依赖负边距，并保留至少 12px 且兼容 `safe-area-inset-left/right` 的安全边距，避免移动 Safari 裁掉页面左右；初级棋盘按容器等分完整显示并使用实体按键式格子材质，中高难度保留横向滑动，状态/重开在左中，移动端挖掘/插旗模式使用工具栏最右侧的分段外观控件（挖掘 | 插旗），整块点按任意位置即切换，选中态高亮；棋盘长按改用 Pointer 事件并容忍 12px 内手指抖动，明显滑动才取消插旗；旗子不受雷数上限限制，超额标记时剩余雷数显示为负数，避免长按被静默忽略；高度不超过 480px 的手机横屏隐藏小迪悬浮入口，避免遮挡最右模式按钮；云端/会话战绩挂载后读取以避免 SSR hydration mismatch；扫雷页还会注册小迪 `playground.hint_minesweeper` 场景工具，收到提示动作后仅在浏览器内存态把已翻开的数字、旗子和隐藏格交给确定性推理器，不向服务端发送棋盘或读取 `isMine` 雷图；页面只用静态高对比描边常亮产生推理依据的数字格并给一个递进问题，关闭移动端聊天面板后仍可见，棋盘发生下一次变化时才清除，不直接标出安全格/雷格，暂无确定结论时引导继续探索；扫雷、五子棋、数独、N 皇后在手机端采用更大的触控棋盘并允许横向滑动；`/playground/*` 游戏内页隐藏全局移动底部导航避免遮挡棋盘/画布，并继承小迪 `playground` surface 且按具体小游戏传递 `gameKey/contextId`，避免迷宫、扫雷等小游戏串场景；首页推荐支持轮换，移动端先展示单个今日推荐并避免与全部游戏列表重复，且不展示数据统计与 STEAM 能力维度进度；游戏卡片均有独立图形 fallback |
| `/playground/functionwars` | `app/playground/functionwars/page.tsx` + `renderer.ts` | 函数战争：无 `eval` 表达式 AST 驱动纯函数弹道；3 主题 10 个战役关 + 5 个挑战关，含可破坏/不可破坏障碍、所有单位的可碰撞前景支撑（贴图落脚线按最近支撑单独做视觉对齐，不改变弹道碰撞几何）、太空后段无地面空岛关与易碎承重坠落结算（敌方失去承重造成一次坠落伤害，己方失去承重本关失败）、表达式必用函数/常量、有效射击函数/武器、信号中继、射击上限和平台保护等任务目标、5 种配置化武器、曲线拾取道具、Canvas 地形破坏/弹道特效/坐标网格、分层 WebP 背景与透明 WebP 单位贴图的超裁切视差及草原云影/峡谷沙雾/太空星闪环境动效（低动态偏好下冻结；无射击/爆炸时环境重绘降到 250ms 一帧，活动特效仍走 rAF）、主题化前景地面/平台材质（可破坏物使用暖色、颗粒与边缘缺口；不可破坏支撑/墙体使用冷灰硬质、斜纹与螺栓）、从实际炮口过渡到函数曲线首点的出膛动画（不改变弹道碰撞几何）、星级与 `function_wars_stats` 战绩；`NODE_ENV=development` 下关卡栏显示开发模式并解锁全部 15 关用于预览；单人/真人弹道纵向出屏后可继续采样并重入，横向越界、断点、发散或采样上限才终止，陡峭采样段按连续线段判定碰撞；真人模式使用 6 位邀请码的共享地图 1v1 回合制房间，100 HP 且单回合伤害封顶 80，避免镜像双中满血秒杀；客户端开火只提交武器、表达式和预期 `shot_seq`，认证 API 用共享确定性模拟器重算命中后调用 service-role RPC；单人/真人切换均保留本局，隐藏的单人计时暂停，在线活跃对局在页签标记；Canvas 提供屏幕阅读器战场摘要，错误/结算自动聚焦，320px 控制台不遮挡画布，短横屏采用战场/控制台双栏并可收起数学键盘；移动端隐藏小迪悬浮入口，避免遮挡函数输入与发射按钮 |
| `/profile` | `app/profile/page.tsx` | 个人主页 — 桌面首屏按「个人 Hero → 本周计划 / 今日行动 → 能力雷达与作品观察摘要」组织，普通桌面主体摘要在宽版卡片内左右并列，大桌面再将经验等级、新手引导（仅未毕业时显示，毕业后由徽章墙承载纪念）与学习打卡放入 400px 右栏；移动端保留 4 个高频入口（内容、消息、钱包、商店）并继续展示本周探索计划、STEAM 雷达、自然观察进度和徽章，头像等级标记独立放在头像下方且头像框装饰不被 Hero 裁切；首页作品统计与摘要读取统一作品，内容库区分「我的作品」与用户创建的「发布的项目」；子路由 `library/`、`timeline/`、`likes/`、`followers/`、`following/` |
| `/settings` | `app/settings/page.tsx` | 用户设置 — 子路由 `profile/`、`appearance/`、`xiaodi/`（小迪语音：自动朗读、移动端长按语音、语音提问播报、提示气泡本设备偏好）、`notifications/`、`privacy/`、`security/`、`safety/`、`about/`；`about/` 对匿名用户公开（页脚关于/FAQ/合作入口），提交反馈仍需登录弹窗；其余设置页未登录会带 `next` 回到原路径；设置首页菜单使用单层列表与轻分隔，子页由 `app/settings/_components/settings-subpage-shell.tsx` 统一承载，主内容保留单层面板，资料/安全内容使用低对比边界的浅色分组，减少嵌套卡片与边框噪音 |
| `/settings/profile` | `app/settings/profile/page.tsx` + `profile-settings-client.tsx` | 个人资料 — 头像、昵称、简介、性别和出生年月编辑；分组表单使用单层面板与无边框浅色区块，保存后刷新认证资料 |
| `/settings/security` | `app/settings/security/page.tsx` | 账号与安全 — 社区互动确认、密码修改和首次手机号绑定；内容以单一列表和轻分隔组织，密码/短信表单通过整行折叠交互展开，具备可访问状态关联，手机号验证流程支持重新填写与加载/错误反馈 |
| `/settings/safety` | `app/settings/safety/page.tsx` | 社区安全中心 — 查看账号安全状态（含当前互动限制）、举报处理、屏蔽关系和安全处罚；列表按单一浅色容器分组，支持取消屏蔽、有效处罚申诉、加载失败重试 |
| `/login` | `app/login/page.tsx` | 登录页 — 手机号 + 短信验证码登录/注册；移动端表单位于页头下方剩余空间中央，使用精简标题/说明并隐藏档案介绍区，桌面端保留辅助价值说明；新注册用户使用不含手机号的随机昵称 `新用户XXXX`，历史手机号昵称在再次登录时自动替换；前台文案只提示手机号，邮箱注册入口已移除，旧邮箱账号仍可在手机号输入框中输入原邮箱后用密码登录 |
| `/auth/callback` | `app/auth/callback/` | Supabase Auth OAuth 回调处理 |
| `/leaderboard` | `app/leaderboard/page.tsx` | 排行榜 — 经验值/等级排名 |
| `/shop` | `app/shop/page.tsx` | 积分商店 — 用金币兑换头像框、名字颜色等虚拟物品；页面采用顶部个人预览 + 全宽商品区，移除重复预览、排行榜和引导说明，商品卡仅保留状态、价格与操作；新增「科学星轨」头像框，采用带蓝紫节点旋转的平面圆 + 视觉居中、上移放大的接近 `/` 方向的前后分层倾斜立体轨道，原子与齿轮以对向错位方式沿同一投影轨道面向用户动态绕行，后半圈被头像遮挡且避免两枚元素同时消失，购买/装备通过商店 RPC 白名单同步 |
| `/coins` | `app/coins/page.tsx` | 金币页 — 余额、收支记录 |
| `/messages` | `app/messages/page.tsx` | 消息中心 — 通知分类、私信会话列表、未读角标；移动端页签下方不重复显示当前分类标题，消息列表外层取消重复面板边框并使用更宽的页面 gutter，通知页签的全部已读收至顶部扫帚图标，私信页签不显示通知清理操作；子路由 `[userId]/` 聊天详情（连续消息不在气泡内重复显示时间，首条或间隔至少 5 小时才显示一次时间分隔；移动/桌面会话头部的头像与昵称进入对应公开主页，屏蔽与取消屏蔽统一在公开主页操作；移动端会话头部提供举报消息入口，可勾选最多 10 条对方消息后统一提交举报，桌面端保留单条悬停举报） |
| `/share` | `app/share/page.tsx` | 分享/创建项目页 |
| `/create` | `app/create/page.tsx` | 创造营 — **技能课程** + **项目挑战** 路由化 Tab；裸 `/create` 默认重定向到 `/create?tab=courses`，项目挑战使用 `/create?tab=pbl`，切换与浏览器历史同步；移动端自有页头不显示跳往探索页的搜索入口；`/create` 重定向自 `/community` |
| `/pbl/[id]` | `app/pbl/[id]/page.tsx` | 项目挑战详情 — Hero + 任务说明 + 阶段工作台 + 作品墙；阶段工作台支持保存一句话项目方向并生成每阶段个人化计划提示；移动端任务说明完整展开，底部固定「记录过程 / 提交终稿」入口，不在正文重复相关项目；报名走挑战详情自己的 joined 状态，不要求创造营列表已加载；无历史时返回 `/create?tab=pbl` |
| `/courses` | `app/courses/page.tsx` | 技能课程列表（Scratch 编程 + 小班/中班/大班大颗粒积木 + 五子棋博弈论入门等）；页面服务端直接读取已审核课程并输出首屏卡片，避免挂载后再请求 `/api/courses` 的瀑布；登录用户按批量课时进度显示已完成数/总数与未开始、进行中、已完成状态，匿名用户保持无个人进度 |
| `/courses/[courseId]` | `app/courses/[courseId]/page.tsx` | 课程详情与课时列表（左文右图 Hero：五子棋课用纯 SVG 棋盘装饰，其它课走 `image_url` 位图；课时卡带序号棋子 + 课时类型徽章；概览查询只读取课时标题/类型/顺序/时长/分轨摘要，不加载每课完整 content/steps；Scratch 编辑器及 vendor 不在课程介绍页预加载，只在进入课时后按需启动，课时链接禁用自动 prefetch；登录用户显示课时完成标记和基于 `next_lesson_id` 的开始/继续/回顾 CTA，空课程不显示完成态） |
| `/courses/.../lessons/[lessonId]` | `app/courses/[courseId]/lessons/[lessonId]/` | 课时学习页（侧栏步骤 + 可选学习目标/教师引导 + 按 `lesson_type` 切换工作区：Scratch 编辑器 / 大颗粒积木 3D 搭建预览 / 游乐场实训导学；Scratch 手机/桌面能力用 hydration-safe 外部存储快照判断，手机首屏不挂载重型编辑器且保留预览/上传入口；所有 `building_3d` 课时通过统一课程流保留 PPT 第 1 页、隐藏第 2/3 页教学目标与教学流程、隐藏搭建说明 PDF，有真实模型时以全部 3D 步骤替换“作品构建”图片区并保留末尾反思/分享/完成页，无真实模型时保留其余图片页；积木课当前页以一基 `?step=N` 写入路由，离开后返回、刷新及浏览器前进/后退都恢复同一步，并保留 `view` / `ldrawEdit` 等已有查询参数；工作区会预加载下一张课件、下一段视频元数据或下一步 3D 模型数据，LDraw 课从前置课件页开始预热首步与按模型格式拆分的 three.js 运行时，材质和模型并行请求，当前可见步骤完成后才预取下一步以免抢占首屏；移动/平板端提供全屏横向展示，支持 Fullscreen / Screen Orientation API 时自动进入系统全屏并锁定横屏，不支持时回退为页面沉浸模式，3D 横屏采用宽画布 + 紧凑右侧步骤栏；课件图在移动端按原始 16:9 比例决定高度、桌面端限制约 900px 最大宽度，避免媒体区出现大块无效留白；积木课移动端隐藏与工作区翻页重复的侧栏步骤，桌面端继续保留；3D 用 three.js `LDrawLoader` 经 `/api/courses/ldraw-step` 按 `0 STEP` 顺序读取当前所需几何，复用 Loader 配色/零件缓存并关闭高成本平滑法线预处理，离开 3D 页面或课时时取消请求、释放 geometry/material/texture 与 WebGL context；LDraw 课程模型优先通过 `.agents/skills/image-to-ldraw` 的 `part-metadata.json` 零件定义和 `validate-assembly.mjs` 统一校验支撑、穿模、管道端口连接与方向约束；playground 课时把游乐场游戏包成导学课，右侧「去实战」按钮跳到对应 `/playground/*` 游戏页；playground 课时在移动端用单栏：隐藏左侧 `LessonSidebar` 步骤列表，由 `PlaygroundWorkspace` 承载讲解 + 紧凑进度条 + 上一步/下一步/完成 + 底部「去实战」按钮，桌面端仍保留双栏）；完成课时仅写可信 `user_lesson_progress`，不再发 `+15 XP`，完成整课后按配置一次性生成能力里程碑并刷新页面反馈 |
| `/courses/.../preview` | `app/courses/.../lessons/[lessonId]/preview/` | Scratch 课时手机端作品预览（player 模式；积木搭建课不使用此页） |
| `/resources/[id]` | `app/resources/[id]/page.tsx` | 学习资料卡详情页（服务端渲染，react-markdown 正文；PBL 挑战「相关资料」三分类脚手架中「资料卡」的落点） |
| `/users/[id]` | `app/users/[id]/` | 其他用户的公开主页，默认展示其公开「作品」，并区分「发布的项目」与徽章；公开主页头像统一使用 `AvatarWithFrame`，并展示用户已装备的头像框与昵称颜色；首屏使用资料页探索背景素材配浅品牌蓝遮罩，统计铺满主页卡片并采用平面分隔栏，移动端使用透明页头保留返回与标题，操作区独立排列在资料区下方，Tab 选中态统一使用品牌蓝，移动端隐藏全局小迪入口避免遮挡公开内容；非法 UUID 在查库前按未找到处理，避免 Postgres `22P02` 打成 500 |
| `/admin` | `app/admin/page.tsx` + `components/admin/safety-queues.tsx` | 管理后台 — 项目审核、探索记录审核、自然观察审核、挑战作品审核、举报/挑战/**技能课程**管理；安全审核页处理自动审核案件与处罚申诉，私信安全案件展示目标消息前后上下文；子路由 `projects/`、`moderator-applications/` |
| `/moderator/apply` | `app/moderator/apply/` | 申请成为审核员 |
| `/legal` | `app/legal/` | 法律条款 — `privacy/`（隐私政策）、`terms/`（服务条款）；法律文档使用单层低对比度容器与无边框导读区，移动端页头完整占位并支持从顶部正常滚动阅读 |
| `/badges-preview` | `app/badges-preview/page.tsx` | 徽章样式预览（仅开发环境可访问） |
| `/xiaodi-preview` | `app/xiaodi-preview/page.tsx` | 小迪吉祥物 7 状态动画预览（仅开发环境；状态切换/自动轮播/深浅底/播一轮回 idle 演示；默认使用 AI sprite，并可切回原版 sprite 对比） |
| `/design-system` | `app/design-system/page.tsx` | 设计系统静态展示（仅开发环境） |
| `/migrate` | `app/migrate/page.tsx` | 数据迁移说明页（只引导使用项目封装的 `pnpm db:push`；长命令在手机端限制于代码块内部横向滚动） |

> `/works/[id]` 移动端详情页使用页面自有的单一返回/标题页头，隐藏全局 Logo 页头与底部导航；完成作品不再单独显示状态胶囊，进行中探索仅在标题栏显示弱状态提示，来源信息由详情中的来源卡承载，桌面端继续保留完整全局导航。

### 全局文件
- `app/layout.tsx` — 根布局：Provider 嵌套顺序（QueryProvider → AuthProvider → ThemeProvider）
- `app/globals.css` — 全局样式与 CSS 变量；Tailwind CSS 4 CSS-first 配置入口（`@theme` / `@utility` / `@plugin`）；统一页面 shell 移动端横向 gutter：16px，桌面按各 shell 规则放大；自然频道不再定义独立 `--nature-*` 主题色，使用全站通用 token
- `app/template.tsx` — 页面过渡模板
- `app/error.tsx` / `app/not-found.tsx` — 全局错误与 404
- 游乐场数独/N 皇后/数字华容道棋盘格提供坐标、数字/皇后状态与选中语义；首页轮播分页和汉诺塔速度控件在手机端使用至少 44px 触控区域
- `app/manifest.ts` / `app/robots.ts` / `app/sitemap.ts` — PWA & SEO；`robots.ts` 全站拒绝 GPTBot，其他爬虫继续遵循公开页面可抓取、私有/API 路径不可抓取的规则
- `proxy.ts` — Next.js 16 Proxy 入口：补种匿名推荐 `rec_viewer` cookie（替代已废弃的 `middleware.ts`）；同时把当前 pathname/search 写入 `x-steam-pathname` / `x-steam-search`，供未传 `next` 的 `requirePageUser()` 拼登录回跳
- `AGENTS.md` / `.cursor/rules/project-context.mdc` — AI/自动化工具项目约定：先读索引、同步维护索引、禁止恢复 `middleware.ts`

---

## 2. API 路由 (`app/api/`)

33 个 API 模块，每个目录下含 `route.ts`：

| 模块 | 路径 | 功能 |
|------|------|------|
| admin | `api/admin/` | 项目审核、完成记录审核、自然观察审核（服务端同步 `status` / `moderation_state` 并校验实际更新，通过后发放观察 XP/徽章并入公开互动队列）、标签管理、举报处理、审核员申请审批、挑战 CRUD（resources 字段经 `lib/api/challenge-resources.ts` 三分类校验）、**技能课程 CRUD**（`admin/courses/`）、**资料卡 CRUD**（`admin/resources/`，草稿/发布，仅草稿可删）、用户创建与会员状态手动开通；`admin/moderation/cases` 处理自动审核案件，`admin/safety/appeals` 处理处罚申诉 |
| assets | `api/assets/` | 受限静态资源代理；代理已迁移到 OSS 的 `/birds`、`/insects`、`/trees`、`/fruits`、`/projects`、**`/courses`**（课件 slides/PDF/视频/成品图/LDraw）和 `/scratch/assets` 资源。各环境默认经代理带 Referer 拉取 OSS（CDN 防盗链，直连会 403），包括生产环境 `/internalapi/asset/*` 的 Scratch rewrite；自定义/环境站点 Referer 被 CDN 拒绝时用公开站点 Referer 重试；**OSS 非 2xx 或代理 fetch 失败时回退 `public/` 同名路径**，本地文件以 Node stream 输出并支持单段 Range/HEAD，视频、PDF 等不再整文件读入进程内存；切换 Referer 或回退前会取消旧上游响应体；上游连接超时/中止且无本地回退时返回 504/502，不再重新抛出以免并发导航时变成 500 与 unhandledRejection；LDraw 打包 MPD 本地更完整时优先本地；白名单 OSS/代理图片与 Supabase Render Transform 图片会绕过重复的 Next/Sharp 转码；仅设置 `NEXT_PUBLIC_ASSETS_DISPLAY_MODE=direct` 时绕过代理直连排查；服务端可读 `ASSETS_BASE_URL` 或 `NEXT_PUBLIC_ASSETS_BASE_URL` |
| courses | `api/courses/` | 技能课程列表/瘦身概览/单课详情；登录态从服务端用户身份附加课程/课时进度，匿名响应不泄露个人进度并使用公共缓存；`ldraw-step` 从本地打包 MPD 提取单一步骤及递归依赖，并剔除 LDrawLoader 忽略的 type 2-5 非标准尾字段（16 MiB 源文件上限、同一步骤同飞去重、最多 4 个不同步骤并发转换、浏览器/CDN 短缓存）；课时 `.sb3` 保存与 signed URL；完成课时不发 XP，首次有效完成通过 service-role 原子 RPC 写可信来源并按需生成一次性课程 STEAM 里程碑；作品提交仍只进入 pending/final，审核通过后由原子 RPC 幂等发放 `+20 XP`；`[courseId]/lessons/[lessonId]/works` 读取课时公开作品与提交当前学员作品 |
| auth | `api/auth/` | 短信发送/验证、OAuth 回调 |
| challenges | `api/challenges/` | 挑战列表与评分；作品提交 `[id]/submission`；投稿草稿 `[id]/submission/draft` 汇总阶段产出、图片、反馈与 STEAM 收获生成可编辑终稿草稿（AI 不可用时回退本地规则草稿）；阶段产出 `[id]/stages`（GET 全部）与 `[id]/stages/[index]`（PUT 落库）；阶段导师反馈 `[id]/stages/[index]/review`（保存当前产出、消耗 AI 配额、生成结构化反馈并写回 `ai_feedback`）；阶段导师工具 `[id]/stages/[index]/coach`（保存当前草稿后生成拆题/提示/总结受控 JSON，仅返回前端展示不写库）；PBL 工作台 `[id]/workspace` 保存个人项目方向并返回受控个人化计划 |
| tutor | `api/tutor/` | **AI 导师小迪**统一对话 `chat`（GET 只读历史+配额+本地开场白（无线程时返回 `conversation: null`，不再自动建空线程；`contextType` 白名单校验，非法值回退 global），`quotaOnly=1` 只刷代币；POST SSE 流式（首条消息才惰性创建线程），global 场景按 `surface` 页面标识（home/explore/nature/create/courses/community/playground/profile/users）差异化场景与开场白并注入个性化推荐项目候选，同时把当前登录用户的有限个人中心摘要（昵称、年龄段、等级/XP、STEAM 能力雷达、累计统计、近期活动、成长任务、课程/PBL 进度、徽章、游乐场战绩、作品反馈、AI 额度）作为服务端只读上下文传入并明确不可见隐私边界，`/playground/*` 游戏页归入 playground surface 并携带具体 `gameKey/contextId` 生成小游戏专属上下文与独立线程；course 场景支持 `lessonId` 课时上下文、species 场景按物种 slug 注入档案（识别/生境/季节），并可在回复流中发送白名单 `tool_call` 结构化事件；开发环境或 `TUTOR_DEBUG_TIMING=1` 下输出服务端阶段耗时、`Server-Timing` 与 SSE `perf` 事件，用于定位响应头/首事件/首 chunk 延迟；DELETE 只归档当前有消息的线程（空线程保留复用，避免堆空归档），新线程由下一条 POST 创建）；POST 计费生命周期：扣费后任何失败路径（场景构建/planner/流式/空回复/落库）统一退款，按剩余可退额度封顶防止重复退；带图对话视觉模型失败降级纯文本时发 `warning`、按文字价计费并退差价，prompt 同步注明图片不可用；模型名、token usage 与 prompt 版本（`TUTOR_PROMPT_VERSION`）写入助手消息 `meta.ai`，客户端 meta 直通字段已移除；送模型历史按字符预算截断（6000 字符、图片按 400 计）；资源检索 planner 与工具 planner 并行执行且均携带最近 6 条对话辅助指代消解；语音辅助 `speech/transcribe`（登录后接收 30 秒内 16k PCM 录音，经 DashScope Qwen-ASR-Realtime 仅转写文本、不落库音频）与 `speech/synthesize`（登录后优先走 Qwen3-TTS-Flash-Realtime 流式 PCM SSE，失败可 `fallback` 回 HTTP 整段合成；chat POST `speak=true` 时在同一条 SSE 里夹带 `audio`/`audio_done`，手动/自动朗读均不扣 AI 对话代币）；历史对话 `conversations`（GET 按场景列归档线程+首条用户消息预览，最近一张聊天图片在上下文窗口内作为活跃附件持续发送并保持视觉模型，上传新图时替换旧图）与 `conversations/[id]`（GET 线程消息，DELETE 删除已归档线程，均做归属校验）；图片接受三类来源（PBL 阶段产出 / 本人观察照片 / 聊天直传 `project-images/tutor-chat`）；落库失败发 `warning` 事件并退代币；代币门禁 `consume_ai_credit`（免费退款按当日 refund 流水抵扣）；Admin `admin/users/[id]/credits`、`admin/ai-usage` |
| comments | `api/comments/` | 历史项目评论读取、编辑/删除与点赞；新增项目评论已停用（`POST` 返回 410），留言统一进入具体作品 |
| completions | `api/completions/` | 完成记录、作品评论、点赞、审核；`[id]/promote` 通过作者专用事务 RPC 将已审核项目过程记录设为完成作品，拒绝旧终稿可重提，并将并发终稿唯一冲突返回 409；发表评论/回复需要社区互动确认和双向屏蔽检查，评论可按 `completion_comment` 举报 |
| discussions | `api/discussions/` | 社区讨论 CRUD、点赞 |
| follows | `api/follows/` | 关注/取关、关注状态查询 |
| blocks | `api/blocks/` | 双向屏蔽关系查询、创建、解除；屏蔽后禁止私信/关注等社区互动 |
| geo | `api/geo/` | 反向地理编码 |
| health | `api/health/` | Docker/负载均衡浅健康检查；仅验证 Next 服务存活，不访问数据库或外部服务；响应附带进程 uptime 与 RSS/heap/external 内存观测值，便于定位 OOM 前的增长趋势 |
| home | `api/home/` | 首页推荐数据 |
| internal | `api/internal/` | 内部 Worker 入口：完成记录审核、自动互动队列执行（短回复/点赞/收藏）与历史 approved 项目低比例 backfill 入队 |
| leaderboard | `api/leaderboard/` | 排行榜数据 |
| messages | `api/messages/` | 私信发送、会话列表、消息线程、未读计数、会话标记已读；发送消息登录即可，仍受账号安全、屏蔽、接收方隐私、频率限制和内容审核约束；消息读取兼容历史 UUID 形状的测试账号 |
| moderator | `api/moderator/` | 审核员资格检查、申请 |
| notifications | `api/notifications/` | 通知列表、标记已读、通知未读计数；全局入口汇总通知 + 私信未读 |
| playground | `api/playground/` | 游乐场云端战绩徽章同步；`badges/sync` 读取 `playground_stats` 并补发已达成的游乐场徽章；`minesweeper/leaderboard` 通过受限 RPC 按难度返回云端最佳成绩全服前十，仅暴露昵称、头像和用时；在线五子棋 `gomoku-rooms`、记忆翻牌 `memory-rooms`、函数战争 `functionwars-rooms` 和通用竞速 `race-rooms` 创建/加入/读取/离开房间；函数战争 `[id]/fire` 认证 API 在服务端重算弹道并通过 service-role RPC 原子校验 `shot_seq`/轮次后结算，`[id]` 权威读取会推进超时并在同一玩家连续错过两回合时判负，邀请链接保留 `room` 参数；竞速加入按 6 位邀请码用 service role 查询并以 `waiting + guest IS NULL` 条件更新，竞争失败返回 409 并记录不含用户/邀请码的结构化指标；`race-rooms/[id]` GET 在读取前调用受限 RPC 结算截止房间，`[id]/result` 校验成绩后由 RPC 原子检查截止时间，双方到齐再计算胜负；邀请链接会等前端 auth 初始化完成后再自动加入，未登录时登录链接用 `next` 保留 `room` 参数 |
| observations | `api/observations/` | 自然观察 CRUD；提交、评论、鉴定和图片分析写入需要社区互动确认，提交先进入待审核，公开列表/点赞/评论/鉴定仅开放已通过记录。`POST /api/observations` 一次创建 1～5 条观察（`items[]`，每张照片一条，`media_urls` 长度为 1），鉴定/AI 票按张写入，失败则回滚整批 |
| profile | `api/profile/` | 个人资料摘要、新手引导、学习打卡、本周探索计划（聚合 PBL 阶段/课程/自然观察/雷达等信号）；`works` 返回当前用户的项目完成作品与课程作品；`growth-tasks/sync` 与 `weekly-plan` 都会读取 `profiles.bio` 并调用 `get_user_stats_summary` 计算成长任务进度 |
| projects | `api/projects/` | 项目 CRUD、编辑；创建项目需要社区互动确认；`[id]/like` 处理项目点赞，`[id]/collection` 处理收藏/取消收藏，均要求登录且受 `interaction_restricted` 门禁；点赞 XP 由服务端固定事件奖励并写入作者通知 |
| replies | `api/replies/` | 回复 CRUD |
| resources | `api/resources/` | 学习资料卡公开读取（仅 published） |
| reports | `api/reports/` | 举报提交；举报命中高风险内容时自动隐藏并创建安全审核案件 |
| settings | `api/settings/` | 用户设置更新；`age-confirmation` 提供 GET 状态和 POST 社区互动确认，确认通过 `confirm_my_age()` RPC 写入，短信验证不自动完成确认；`feedback` 将设置页反馈发送到配置的官方管理员账号，管理员通过现有站内私信回复；`safety` 返回屏蔽、举报、处罚与申诉状态，`safety/appeals` 只接受当前有效处罚的申诉 |
| species | `api/species/` | 旧物种分页查询（过渡保留）；`api/species/atlas/` 返回不含详情大字段的全量图鉴 DTO，响应按当前 Cookie `private, no-store`，点亮查询失败时显式返回 `unavailable` |
| tips | `api/tips/` | 打赏；`tips/my` 匿名直接返回 `myTipped: 0`，不走需登录的限流桶（否则 F12 会看到 429） |
| upload | `api/upload/` | 图片上传（Supabase Storage）：魔数/大小校验 + 通义千问图片安全审核，不通过或审核不可用时删除已上传对象；审核拒绝返回 `code=image_content_rejected` 并透传安全原因给前端 toast，同时打结构化 warning 便于管理员查服务日志（当前不入 admin 后台列表） |
| upload-video | `api/upload-video/` | 视频上传 |
| users | `api/users/` | 用户公开信息查询；`[id]/works` 返回指定用户已公开的统一作品 |
| works | `api/works/` | 统一作品读取与互动；`[id]` 返回项目/课时来源、作者、媒体、点赞、评论和打赏信息 |
| explore | `api/explore/` | 探索相关数据；`works` 接受 `limit`/`offset`，通过 `get_trending_works` RPC 返回近期互动热度作品批次，供首页“换一批”使用 |
| xp | `api/xp/` | `increment` 接口废弃并返回 `410 XP_EVENT_REQUIRED`；固定 XP 只能由服务端业务事件发放，客户端不能提交金额 |

函数战争房间创建/加入会拒绝用户进入第二个 `waiting/playing` 活跃对局；API 前置检查返回可读的 409，数据库用参与者 advisory lock 触发器封住并发竞态。房主重开自己的等待邀请会恢复到 `waiting`，不会停留在 `joining`。

互动资格边界：课程完成、Scratch/积木项目保存、PBL 阶段与工作区保存、项目探索和私信发送登录即可；项目/课程/挑战作品提交、自然观察提交、评论/鉴定/评分和发帖需要社区互动确认，内部由 `age_confirmed_at` 记录；私信另受接收方隐私设置、双向屏蔽、频率限制、内容审核和 `interaction_restricted` 控制；项目/作品/自然观察点赞、收藏、关注和打赏属于 `engage`，登录即可。项目上下文的收藏写入统一经 `POST /api/projects/[id]/collection`，不再由浏览器直接写 `collections` 表。

---

## 3. 组件 (`components/`)

### 3.1 基础 UI (`components/ui/`) — 39 个组件
基于 shadcn/ui + Radix UI 的基础组件库：
`alert` · `avatar` · `avatar-with-frame` · `badge` · `button` · `card` · `checkbox` · `countdown-timer` · `dialog` · `difficulty-stars` · `dropdown-menu` · `filter-chip` · `image-upload` · `input` · `label` · `leaderboard-skeleton` · `loading-skeleton` · `mobile-page-header` · `optimized-image` · `page-status` · `progress` · `radio-group` · `report-dialog` · `role-badge` · `scroll-area` · `search-highlight` · `select` · `separator` · `sheet` · `skeleton` · `slider` · `surface` · `table` · `tabs` · `textarea` · `toast` · `toaster` · `tone-badge`
- `components/ui/button.tsx` — 全局按钮：默认圆角 `--radius-sm`（10px），移动端顶部按钮和普通操作走默认圆角；大号主 CTA / 审核动作 / 底栏固定按钮可使用 `shape="pill"`，紧凑图标按钮可用 `shape="square"`。
- `components/ui/mobile-page-header.tsx` — 统一移动端页头；返回箭头使用固定 44px 触控区并贴近内容左边界，页面不再通过负边距单独调整位置。
- `components/ui/loading-skeleton.tsx` — 项目/挑战/自然详情骨架屏；`ChallengeCardSkeleton` 支持可选 `className` 供页面局部统一圆角和外观。

### 3.2 布局 (`components/layout/`) — 14 个组件
- `conditional-app-shell.tsx` — 根据路由条件渲染 Header/BottomNav/Sidebar
- `bottom-nav.tsx` — 移动端底部导航
- `main-nav.tsx` — 桌面端顶部导航
- `mobile-global-header.tsx` — 移动端全局头部；顶部铃铛作为消息中心唯一入口，头像菜单只保留个人中心、按权限显示的管理/审核员入口和退出登录，钱包、内容库、编辑资料和商店从个人中心的快捷入口进入；桌面端头像菜单保持完整入口
- `header-search.tsx` — 头部搜索栏
- `user-button.tsx` — 用户头像菜单；有效会员/创始会员显示会员身份与到期状态
- `notification-bell.tsx` — 通知铃铛
- `share-button.tsx` — 分享按钮
- `login-dialog.tsx` — 登录引导弹窗
- `interaction-confirmation-dialog.tsx` — 发布、评论、发帖或私信前的社区互动确认弹窗；确认成功后由 `login-prompt-context` 重试原操作
- `logo.tsx` — 品牌 Logo（`public/logo.png` 透明圆形标）
- `theme-provider.tsx` / `theme-toggle.tsx` — 主题切换
- `error-boundary.tsx` — 错误边界

### 3.3 首页 (`components/home/`)
- `home-showcase.tsx` / `home-works-section.tsx` — 首页主体：Hero、「从这里开始」六方向入口、统一作品预览、最近公开自然观察、社区动态与本周挑战；本周挑战标题/摘要/封面来自 `getFeaturedPblChallenge()`，不再使用写死文案；作品区 SSR 首批后由客户端调用 `/api/explore/works?limit=4&offset=...` 换批，作品卡进入 `/works/[id]`，自然观察紧凑卡进入观察详情；桌面作品/自然双栏，移动端两列作品后顺序展示观察记录，并保留自然观察/排行榜横向快捷入口
- `mobile-shortcut-carousel.tsx` — 首页移动端自然频道/排行榜快捷卡横向 snap 轮播；整卡全宽（不再露半张 peek），滚动和点击分页点时同步当前指示点；分页点采用紧凑排列，减少与后续内容之间的空白
- `compact-project-grid-styles.ts` — 首页热门 / 探索列表共用的两列竖版项目卡网格与卡片样式 class
- `recommendation-panel.tsx` — 推荐项目面板

### 3.4 业务功能 (`components/features/`)

| 子目录 | 文件数 | 职责 |
|--------|--------|------|
| `bird-observation/` | 22 | 观察提交表单、照片上传、Leaflet 地图选点/热点预览、观察卡片、物种热点面板、物种统计面板（无观察记录时隐藏）、评论区；地图引擎从本站静态资源加载，底图继续使用国内高德瓦片；提交一次可多选最多 5 张照片，每张单独成为一条观察，物种/性别/阶段/地点/拍摄时间跟这张图走；EXIF 只预填该图，禁止用首张 GPS 覆盖其他图；无 GPS 的图需搜索或地图选点，可选「用到其余未定位照片」；主流程无描述；观察详情轮播复用共享 `SwipeablePhotoViewer` / `ImageLightbox`，当前缩略图使用 eager 加载、其他缩略图保持 lazy，保证切换后的选中缩略图立即可见；观察详情 AI 鉴定头像使用 `public/xiaodi-ai/idle-0.webp` 小迪静帧 |
| `challenge/` | 5 | 挑战提交表单（新建时按阶段产出汇总预填，并可一键整理成可编辑投稿草稿：标题、作品说明/反思、阶段图片与 STEAM 收获）、PBL 信息 `pbl-info`（「相关资料」按 参考项目/前置技能/资料卡 三分类分组渲染，带描述行）、评分星级、阶段工作台 `stage-workspace`（逐步解锁引导：未解锁阶段不渲染，仅显示"还有 N 步"折叠提示；支持保存个人项目方向并显示每阶段个人化计划；阶段产出防抖自动保存，唯一主按钮「完成这步」+完成清单(成功标准)+导师工具「帮我拆题 / 给我提示 / 整理这步」返回受控参考卡；「请导师看看这步」生成并持久化 做得好/还缺/下一步 反馈卡；注册小迪 `pbl.focus_current_stage` 工具 handler，在卡住/下一步/反馈意图下展开并高亮当前阶段）、提交作品画廊 |
| `courses/` | 17 | 技能课程列表、课时侧栏与工作区路由；`course-board` 是可由服务端直接传入课程的展示组件，`course-board-loader` 仅供创造营在用户切换到课程页签后按需请求；Scratch 持久 Host 复用单一 iframe 并支持作品发布，Scratch 工作区支持“自检这步”，按当前选中对象的 VM 积木、参数与连接关系给出已完成/未找到/需核对，并可把下一处缺项交给现有积木高亮；积木定位已覆盖四则运算与 `x/y 坐标`、方向、大小、音量 reporter；大颗粒积木工作区用 three.js/LDraw 渲染课件与分步模型，游乐场工作区承载导学和完成课时；三个 workspace 的完成反馈不再显示 `+15 XP`，而是显示进度保存或整课 STEAM 更新；`content.workSubmission.enabled` 为 true 时，`lesson-works-gallery` 直接读取当前课时公开作品，`lesson-work-upload` 复用完成作品弹窗并提交到课程课时 works API，无需项目 Provider 或背书项目；课程终稿上传成功后进入统一作品详情并直接打开分享卡片 |
| `works/` | 4 | 统一作品 UI：`work-card-grid` 为探索页、课程与个人主页提供响应式作品卡片，封面不再叠「课程/项目」标签，类型徽章与标题同一行，下一行放课程名或作者与点赞、留言数；`work-detail` 展示媒体、来源、作者、评论和审核状态，项目探索时间线最多展示最近 50 条并在截断时标出总数，点赞/投币与作者信息同行，作品留言的回复/举报控件保留至少 44px 触控命中区，投过币的作品会在投币按钮上显示琥珀色已支持状态，空创作说明不占位，并仅向作品作者开放分享交互；`work-image-gallery` 提供预览、缩略图跳转和全屏看图，时间线内按竖图比例居中展示并裁切在卡片内，避免横框留白溢出；`share-work-dialog` 内的 `ShareCardDialog` 统一为作品和项目生成固定画布高清卡片与高纠错二维码，并提供系统分享、保存图片和复制链接 |
| `community/` | 1 | 讨论列表（含搜索、排序、分页） |
| `gamification/` | 11 | 徽章图标/画廊、等级进度、排行榜、成就 Toast、每日登录同步（登录用户首页也挂载，临时失败自动重试）、观察游戏化同步；徽章解锁先写入轻量 `badge-unlock-store`，`badge-unlock-overlay-mount` 只有队列非空时才加载 confetti/Framer Motion 庆祝层；单枚全屏庆祝可点跳过/超时关闭，同批 ≥2 枚改为汇总网格一次看全并链到 `/profile` 图鉴 |
| `moderator/` | 2 | 审核员申请表单 |
| `tutor/` | 18 | 全局 AI 导师「小迪」（吉祥物史迪姆）：`tutor-context` Provider（含场景 override、Scratch 编辑器上下文、scene capability、待发送消息队列与白名单 tool handler 注册/分发），`tool-handler-registry` 负责把后端 tool 名映射到当前页面提供的“聚焦课程步骤 / 聚焦 PBL 阶段 / 扫雷公开棋盘提示”等前端能力，并反推出当前 scene capability 供请求一并上送，避免各页面自己逐个绑定工具名；`scene-capabilities` 同时管理页面动作能力和回复增强能力，`speciesAudio` 仅在物种档案/自然观察记录有鸟类音频时由服务端场景授权，课程场景不自动补鸟鸣；`global-tutor-mount` 按路由感知场景（含课时页 `lessonId`）并让 React Query 预取延后到小迪模块加载后、`global-tutor-fab` 已从巨石组件拆为编排层（约 700 行）+ 专职模块：`tutor-stream-protocol`（SSE `data:` 行解析，跨 chunk/UTF-8 安全）、`use-tutor-chat-stream`（消息状态、流式请求、AbortController、tool call 分发、session 缓存）、`tutor-pcm-player`（24kHz PCM Web Audio 排队播放）、`use-tutor-voice`（录音/转写/流式 TTS/自动朗读/移动端长按桥接）、`use-tutor-history`（历史列表/详情/删除/新话题）、`use-tutor-fab-drag`（悬浮球拖拽与长按互斥）、`tutor-message-list` / `tutor-composer` / `tutor-voice-feedback`（消息区、输入区、语音反馈 UI）；发送用 AbortController 持有在途 SSE（场景切换/卸载时中止旧流，防止旧话题内容和 busy 态串进新场景；主动中止静默清掉流式占位气泡，服务端仍会完成落库），使用 `<XiaoDi>` AI 8 帧候选作悬浮球，面板头部同一只小迪随 `idle/listening/thinking/speaking/working/success/error` 状态切换（录音时 listening、转写和请求时 thinking、流式输出和语音朗读时 speaking、tool call/图片上传时 working、工具或回复成功后短暂 success、配额/请求/工具/上传失败时短暂 error，success/error 经 `onCycleEnd` 回落），并保留流式对话（输入区为上文本下工具栏：左传图 `+`、右语音/发送，多行 textarea 默认约 2 行并随内容增高至上限；聊天框可直传图片，审核拒绝时展示后端安全原因；面板内语音按钮经 `tutor-voice` 采集 16k PCM 后调用后端转写并回填输入框，录音/识别/准备朗读/朗读期间显示声波或加载状态反馈与录音计时；移动端关闭态可长按小迪直接录音，松手转写后自动发送，并按本设备偏好播报这次回复，关闭态也显示语音状态浮层；小迪头上会按节流偶尔显示“长按说话”提示；小迪回复可逐条手动朗读，⋯ 菜单含默认开启的“自动朗读新回复”总开关，完整语音偏好在 `/settings/xiaodi` 调整，TTS 默认音色为更中性的 `Ethan` 且可用环境变量覆盖，自动朗读在 chat SSE 里边出字边播 PCM，点喇叭同样走流式合成，HTTP 整段音频仅作回退；场景照片一键发图、Scratch 课时页紧凑位；打开时优先消费预取缓存，⋯菜单含「开启新对话」与「历史对话」，归档线程列表+只读回看视图，并可删除历史对话（归属校验后级联清理消息）；消费 SSE `tool_call` 事件并交给当前场景 handler，支持 PBL 阶段聚焦、课时步骤聚焦与扫雷非透视提示；发送 Scratch 课时消息时附带当前选中角色/对象，避免默认说“小猫”）；图鉴首页移动端隐藏全局悬浮入口，避免遮挡 tile；`tutor-session` 会话 query key/fetch helper、`tutor-message-content` 回复轻量 Markdown 渲染 + Scratch 分类图例/积木形状富文本 + `[project:ID|标题]` 项目 chip + 经 `speciesAudio` 授权的 `[audio:slug|物种名]` 内联鸟鸣播放器、`xiaodi.tsx`+`xiaodi.module.css` 小迪吉祥物动画组件 `<XiaoDi state size onCycleEnd variant />`（默认 7 状态 idle/listening/thinking/speaking/success/error/working；`variant="default"` 读取 `public/xiaodi/sprite.webp`，默认 `variant="ai-draft"` 读取 `public/xiaodi-ai/sprite.webp`，运行时每个变体只加载一张 sprite 并用坐标切帧 + 状态化 CSS 补间：呼吸/前倾/摇摆/点头/弹跳发光/歪头/顿挫；状态切换 160ms 淡入淡出、关闭态静态入口只加载轻量 `idle.webp`，完整 sprite 在浏览器空闲或首次交互后加载，切换变体前等待目标 sprite decode 且保留上一姿势，避免加载期透明闪帧；AI 候选 idle/listening/thinking/speaking/error/success/working 分别约 3.6s/3.2s/2.8s/2.8s/1.8s/1.5s/4.2s 一轮；`prefers-reduced-motion` 降级静帧、`onCycleEnd` 支持 success/error 播一轮切回 idle） |
| `playground/` | 14 | 键盘帮助弹窗、五子棋棋盘/在线大厅/在线对局、记忆翻牌在线大厅/在线对局、函数战争在线大厅/共享战场、通用竞速房间面板、数织通关作品；函数战争在线战场支持双方 HP/回合倒计时、函数输入与数学键盘、武器/增益、对手弹道回放和胜负结算；扫雷移动工具栏使用稳定的「重开」文字按钮与「挖掘 | 插旗」分段外观（整块点按切换），并提供可展开的点击、长按和重开操作说明；小迪 playground 场景按具体小游戏 `gameKey` 区分上下文，扫雷才使用扫雷操作规则和提示工具，函数战争只提供函数族/平移缩放线索，迷宫使用迷宫、岔路、迷雾探索与 BFS/DFS/A* 复盘口径 |
| `project/` | 9 | 完成项目弹窗（作品照片支持一次多选、继续追加并按选择顺序提交，最多 9 张；终稿提交后把作品 ID 传给详情页并自动打开分享卡片）、项目详情操作栏（项目分享接入统一 `ShareCardDialog`）、打赏弹窗、续做卡片 |
| `social/` | 3 | 关注按钮、用户屏蔽按钮 |
| `shared/` | 4 | 通用评论卡片、底部回复框、可左右滑动的 `SwipeablePhotoViewer`、全屏 `ImageLightbox`（左右滑动切图、双指/滚轮缩放、双击放大、下滑关闭；作品详情与观察详情共用） |
| `profile/` | 16 | 头像上传、编辑资料弹窗、本周探索计划卡（失败回退今日行动卡，步骤统一用 3D spot icon，当前周完成项保留显示并弱化为“已完成 / 查看记录”，含 `plan-*` 图标）、STEAM 雷达图、新手引导行（毕业后整卡不再渲染）、学习打卡卡片、骨架屏；`profile-spot-icons` 统一内容层/导航 icon（`public/assets/profile-icons/` 3D WebP） |

> 作品提升成功后，`work-detail` 必须保留 `/works/[id]?share=1` 查询参数，由详情页自动打开分享卡片；探索记录到作品的浏览器回归位于 `e2e/integration/core-flow.spec.ts`。

> `/works/[id]` 详情页视觉层次：首屏明确展示作品标题与探索状态；无探索过程的作品使用带媒体计数与缩略图胶囊的作品展台，有探索过程时以时间线为首要内容并在时间线末尾突出最终成果，避免重复渲染主图；作者/支持、来源、探索时间线和留言区使用可辨识的内容面板，来源卡保留项目/课程课时上下文与返回入口，时间线记录卡在移动端保持连续滚动并保留 44px 级操作命中区。

### 3.5 管理后台 (`components/admin/`) — 13 个组件
项目审核卡片、探索记录审核、自然观察审核卡片、挑战管理（资源行支持三分类选择 + 描述，「资料卡」类型可从已发布资料卡库选取自动填链接）、**技能课程管理** `course-management`、**资料卡管理** `resource-management`（Markdown 正文编辑、草稿/发布切换）、完成审核、审核员申请列表、举报列表、私信举报上下文 `message-context`、自动审核/处罚申诉队列 `safety-queues`、全部项目管理、用户会员管理 `user-membership-management`

### 3.6 认证 (`components/auth/`)
- `auth-flow.tsx` — 完整登录/注册流程（手机号 + 验证码）

### 3.7 个人资料 (`components/profile/`) — 8 个组件
移动端个人主页、资料头部、作品库、点赞列表、时间线、用户列表、项目列表

### 3.8 其他
- `components/providers/query-provider.tsx` — TanStack Query Provider
- `components/icons/coin-icon.tsx` — 金币图标

---

## 4. 核心库 (`lib/`)

### 4.1 Supabase (`lib/supabase/`)
- `client.ts` — 浏览器端 Supabase 客户端
- `server.ts` — 服务端 Supabase 客户端（含 Cookie 处理）
- `admin.ts` — Service Role 管理客户端
- `rpc.ts` — RPC 调用封装
- `env.ts` — 环境变量读取
- `types.ts` — 数据库类型定义（自动生成）

### 4.2 上下文 (`lib/context/`)
- `auth-context.tsx` — 认证状态（用户、角色、登录/登出）
- `project-context.tsx` — 项目操作（CRUD、点赞、收藏、评论、完成记录）；点赞与收藏写入统一经项目 API，收藏不再由浏览器直接写 `collections`
- `community-context.tsx` — 社区操作（讨论、回复、点赞）
- `challenge-context.tsx` — PBL 挑战列表与报名；`joinChallenge` 不依赖列表缓存或 React `user` 是否已刷新，首页深链到 `/pbl/[id]` 后仍会请求报名接口；详情页 `autoLoad={false}` 避免再拉全量列表
- `gamification-context.tsx` — 游戏化（XP 增减、徽章检查、等级计算）；`checkBadges` 同批多徽章乐观更新基于最新 ref，失败只回滚当前徽章
- `notification-context.tsx` — 通知（获取、标记已读、通知未读 + 私信未读汇总计数；未读数请求有 1.5s 模块级短缓存/同飞去重以压住 StrictMode 与多入口刷新；生产可经 Supabase Realtime 私有通道 `unread-counts:<user_id>` 订阅 `notifications`/`messages` 表变更刷新，通道访问由 `realtime.messages` RLS 限定为本人，本地开发默认跳过 Realtime WebSocket；Realtime 失败后自动断开并保留 HTTP 兜底，页面回到前台兜底刷一次）
- `login-prompt-context.tsx` — 未登录操作引导弹窗；互动 API 返回 `AGE_CONFIRMATION_REQUIRED` 时保存原请求并打开社区互动确认弹窗，确认成功后自动重试原操作；设置页仍可提前完成确认

### 4.3 API 服务层 (`lib/api/`) — 24 个模块
服务端 API 的核心业务逻辑，被 `app/api/` 路由调用：
- `auth.ts` / `auth-rate-limit.ts` — 认证与频率限制
- `explore-data.ts` — 探索页数据查询（搜索、筛选、排序）
- `categories.ts` — 分类与子分类
- `challenge-submissions.ts` / `challenge-settlement.ts` — 挑战提交与结算
- `pbl-challenges.ts` — 创造营挑战分组与首页精选 PBL（优先 `timed` active）
- `nature-observation-*.ts` — 自然观察全套（首页/数据/事件/热点/物种/封面/审核；`nature-observation-atlas.ts` 读取 active 鸟类/昆虫/植物轻量 catalog，按服务端中文名称稳定排序并合并 atlas 缩略图 manifest；图鉴/首页/个人进度通过 `get_my_observed_species_ids()` 共用审核通过 + 共识优先/AI >= 0.8 兜底口径；观察列表分页的计数与取数并发发出并共用同一份可见性过滤条件（`PUBLIC_OBSERVATION_FILTERS`），越过末页时把 PostgREST 的 416/`PGRST103` 当作空页并保留真实 total，避免深链接报错；旧分页物种 DTO 与详情继续保留；植物图集同时读取树木与水果资源；详情图集在单张资源加载失败时自动剔除并切到下一张）
- `nature-observation-progress.ts` — 用户自然观察进度摘要：按专题汇总已观察/待观察物种，并提供个人页待观察预览
- `nature-observation-observed-species.ts` — 已观察物种统计：请求级调用无 user id 的 `get_my_observed_species_ids()`，审核通过记录上优先取社群共识物种，否则取 AI 置信度 ≥ 0.8 的鉴定结果；保留事件批量读模型供历史进度/生命周期数据使用
- `observation-gamification.ts` — 观察游戏化逻辑
- `lib/observations/submit-topic.ts` — 观察提交专题（birds/plants/insects）归一化与文案；提示每张照片单独成为一条观察
- `lib/observations/traits.ts` — 观察生命阶段/性别枚举、选项与展示文案
- `lib/observations/display.ts` — 观察详情标题（物种名 / AI 建议 / 未知类别）、日期格式化
- `lib/observations/consensus-ui.ts` — 社群共识进度（2 票规则；确认后仍可继续认同/不同鉴定）与 UI 文案
- `lib/observations/activity-stream.ts` — 鉴定与评论合并为动态流
- `lib/observations/photo-draft.ts` — 按张草稿（物种/性别/阶段/地点/时间）与定位套用
- `lib/observations/create-payload.ts` — 批量创建观察的 `items[]` 校验（1～5 张，禁止重复 URL）
- `lib/observations/create-rollback.ts` — 批量创建失败时按 id 删除已插入观察，并核对删除行数
- `lib/observations/photo-metadata-autofill.ts` — 单张照片 EXIF 拍摄时间/GPS 自动回填；缺 GPS、坐标转换失败和地点反查失败只提示这一张，不会用其他照片的坐标覆盖
- `lib/nature/action-buttons.ts` — 自然观察操作按钮统一样式（`brand` / `outline` / `destructive`，默认 10px 圆角）
- `project-access.ts` / `project-validation.ts` — 项目权限、文字安全与封面/步骤图片归属校验
- `interaction-access.ts` — 统一互动资格判定：匿名/已注册/已确认/restricted；保存进度和私信发送登录即可，投稿、评论、发帖等公开内容写入需要社区互动确认
- `challenge-submission-validation.ts` — 挑战投稿标题/说明/图片说明敏感词校验，证明图片/视频必须来自当前账号上传
- `completion-access.ts` — 完成记录权限
- `safety/` — 社区安全服务层：屏蔽关系、审核案件、内容 `moderation_state` 投影、举报处罚、账号限制同步与证据保留；私信安全案件在证据快照中保留目标消息前后各 3 条可见上下文
- `validation.ts` — 通用输入验证、敏感词校验、上传 URL 归属/本地可信资源校验；`isUuid()` 供公开主页等 UUID 路径在查库前拦截非法 id
- `upstream-errors.ts` / `rate-limit.ts` — 错误处理与限流
- `types.ts` — API 层类型
- `server-awards.ts` — 服务端固定 XP 事件奖励封装；调用 service-role-only 的 `award_xp_once()`，按用户/动作/业务资源幂等发放，并在可信评论路由中结算每周 5 次讨论奖励

### 4.4 配置 (`lib/config/`)
- `categories.ts` — STEAM 五大分类定义与图标
- `category-images.ts` — 分类封面图路径
- `nature-topics.ts` — 自然主题（鸟类、昆虫、植物等；植物专题包含树木、花草与水果干果）
- `project-steam-weights.ts` — 项目 STEAM 能力权重计算
- `subcategory-steam-weights.ts` — 子分类权重映射

### 4.5 游戏化 (`lib/gamification/`)
- `badges.ts` — 全部徽章定义（独立/阶梯/系列）；阶梯系列用 `tierNames` 独立成就名，档位可用 `BADGE_TIER_LABELS` 作说明文本；资料页精选徽章每个阶梯系列只取最高已解锁档，徽章图鉴展示全量档位；连续打卡白金 `streak_platinum`（百日恒心）为连续登录 100 天；社区 `social` 阶梯统计发帖/评论/回复；自然观察合并为观察记录 `bird_observer` 与物种收集 `species_collector` 两条阶梯；游乐场收敛为跨游戏阶梯 `playground_explorer` / `playground_victories` 与 9 枚高难度彩蛋 `playground_star`（含完成函数战争 10 个战役关的 `function_wars_all`「曲线大师」与完成 5 个挑战关的 `function_wars_challenge_all`「函数指挥官」）；内测徽章 `beta_tester`（测试先锋）由 `GRANT_BETA_TESTER_BADGE` 控制，当前对所有登录用户自动发放，结束后改 `false` 停发新人（已获得者保留）
- `playground-badges.ts` — 从 `playground_stats.stats` 云端 JSON 解析各游戏战绩为 `UserStats`（含 `playgroundGamesPlayed` / `playgroundWinsTotal` 聚合），并为 `/api/playground/badges/sync` 补发游乐场阶梯与彩蛋徽章；保留游戏页前端即时 `checkBadges` 只用于当场反馈
- `experience-rules.ts` — XP 经验规则与等级表；每日登录同步由 `DailyCheckInSync` 调用 `daily_check_in`，成功后触发连续打卡徽章检查
- `observation-events.ts` — 观察事件类型
- `types.ts` — 游戏化类型定义

### 4.6 SEO (`lib/seo/`)
- `metadata.ts` — 页面元数据构建工具 `buildPageMetadata()`
- `site.ts` — 站点基础配置（名称、URL、描述）

### 4.7 首页 (`lib/home/`)
- `recommendations.ts` — 首页数据聚合（趋势统一作品、最近公开自然观察、社区动态、分类计数、当前精选 PBL）与推荐 API 算法（个性化/热门兜底；供 `/api/home/recommendations` 使用）；捕获数据降级错误前会用 Next `unstable_rethrow` 先交还动态渲染/重定向等框架控制流，避免构建期动态路由信号被业务日志误报
- `community-feed.ts` — 社区动态 Feed 数据
- `category-tiles.ts` — 分类磁贴数据

### 4.8 个人资料 (`lib/profile/`)
- `timeline.ts` — 用户活动时间线
- `next-action.ts` — 个人主页「今日行动」决策：按可领取新手引导、探索中项目、未完成新手引导、STEAM 雷达补短板、自然待观察物种、时间线回顾等顺序给出下一步（作为本周探索计划加载失败时的 UI 回退）
- `weekly-plan.ts` — 个人主页「本周探索计划」纯规则生成：3-5 步学习路径，聚合并保留当前周已完成时间线（最多 3 条）、PBL 阶段、在学课程、探索中项目、STEAM 雷达、自然观察与新手引导；同一摘要供小迪 profile 场景解读
- `growth-tasks.ts` — 新手引导系统（内部模块名仍为 growth-tasks）
- `steam-radar.ts` — STEAM 能力雷达图数据
- `study-checkin.ts` — 每日打卡展示逻辑；后端 `get_user_study_checkin_summary` 同时计入每日登录打卡、已通过项目终稿、已通过观察与待审/已通过挑战作品
- `settings.ts` — 设置项读写
- `avatar-options.ts` — 默认头像选项

### 4.9 其他模块
| 模块 | 文件 | 职责 |
|------|------|------|
| `lib/mappers/` | `project.ts`, `types.ts` | 数据库行 → 前端模型映射；`ChallengeResource` 三分类（`project`/`skill`/`reference`）+ 可选 `description`，`normalizeChallengeResources` 对历史旧 type 归一化并剔除 CTA 条目 |
| `lib/pbl/` | `challenge-workspace.ts`, `challenge-stage-review.ts`, `challenge-stage-progress.ts`, `stage-coach-actions.ts`, `challenge-submission-draft.ts` | PBL 工作台个人项目方向、个人化计划 JSON 类型、确定性计划生成与数据库行映射；阶段导师反馈上下文/产出摘要构建；阶段产出快照比较与反馈失效判断；导师工具动作（拆题/提示/总结）受控结果归一化；投稿草稿规则汇总、STEAM 收获提取与 AI 草稿归一化 |
| `lib/learning-resources.ts` | `learning-resources.ts` | 资料卡共享常量/类型/映射（分类 `principle`/`material`/`method`/`skill`/`case`，状态 `draft`/`published`） |
| `lib/api/learning-resources.ts` | `learning-resources.ts` | 服务端读取已发布资料卡（React.cache 去重，供详情页与公开 API 共用） |
| `lib/api/nature-observation-*` | `nature-observation-data.ts`, `nature-observation-atlas.ts`, `nature-observation-homepage.ts`, `nature-observation-events.ts`, `nature-observation-species.ts` | 自然观察读模型聚合入口、全量物种图鉴 catalog/观察状态、首页/专题/热点/物种/观察列表数据；atlas 公共 catalog 用 Next `unstable_cache`，个人观察状态按请求合并且不进入跨用户缓存；首页个性化加载在业务降级前保留 `unstable_rethrow` |
| `lib/nature-species-atlas.ts` | `nature-species-atlas.ts` | 图鉴 DTO、专题固定顺序、中文名称稳定排序、客户端搜索/专题/观察状态过滤与筛选 key |
| `lib/api/challenge-resources.ts` | `challenge-resources.ts` | 挑战 resources 字段服务端校验（title/url 必填、type 三分类枚举） |
| `lib/shop/` | `items.ts` | 商店物品定义与价格；头像框样式映射包含「科学星轨」 |
| `lib/ai/` | `dashscope.ts`, `qwen-vision.ts`, `observation-media-analysis.ts`, `upload-content-moderation.ts`, `completion-moderation.ts`, `completion-proof-vision.ts`, `pbl-stage-coach.ts`, `auto-reply.ts` | 通义千问/DashScope AI：`dashscope.ts` 是共享 HTTP 客户端（鉴权、非流式 20s / 流式 120s 超时、错误归一、token usage 解析），按角色保留模型 env 链（tutor-text/planner/vision、vision、moderation、pbl-text/vision、auto-reply）。物种识别走 `vision`（默认 `qwen3.7-plus`）；上传图与作品配图审核走 `moderation`（`DASHSCOPE_MODERATION_MODEL` → `DASHSCOPE_VISION_MODEL` → 默认 `qwen3-vl-flash`）。观察提交先读媒体分析，已通过的图片不再二次视觉审核，只审文字；作品异步审核在提交时 `moderation_state=approved` 则跳过配图视觉、只跑文字语义审核，其余多图并行。完成作品文字审核由模型按语义判断，不使用敏感词列表决定 AI 审核结果。TTS/ASR 仍走 `lib/ai/tutor/speech.ts` |
| `lib/auto-interactions.ts` | `auto-interactions.ts` | 自动互动队列：公开项目/完成记录/自然观察的延迟短回复、点赞与项目收藏 |
| `lib/sms/` | `aliyun.ts`, `send.ts` | 阿里云短信验证码 |
| `lib/content-filter/` | `index.ts`, `words-zh.ts`, `words-en.ts` | 敏感词过滤 |
| `lib/notifications/` | `navigation.ts` | 通知跳转路由映射 |
| `lib/community/` | `reply-utils.ts`, `featured-nature-challenges.ts` | 回复工具、精选挑战 |
| `lib/playground/` | `catalog.ts`, `storage.ts`, `use-playground-stats-loader.ts`, `minesweeper-stats.ts`, `minesweeper-hint.ts`, `online-room.ts`, `gomoku-online.ts`, `memory-online.ts`, `race-online.ts`, `gomoku-engine.ts`, `gomoku-ai-client.ts`, `gomoku-ai.worker.ts`, `gomoku-rapfi.ts` | 游戏目录、战绩存储（登录用户以 `playground_stats` 云端为唯一持久化，会话内存镜像，遗留 localStorage 仅登录时一次性迁入后清除；未登录仅会话内存）；`usePlaygroundStatsLoader` 在云同步后重载各游戏战绩；扫雷统一写入 `minesweeper_stats`，读取时经 `readMergedMinesweeperStats` 合并旧 `minesweeper_best_times`；`minesweeper-hint.ts` 只接收已翻开数字/旗子/隐藏格的公开状态，用“旗数等于数字则其余安全、旗数加隐藏数等于数字则隐藏格必为雷”规则返回确定性提示，输入类型不含 `isMine`；`online-room.ts` 提供在线对战共享房间码/状态类型；`race-online.ts` 定义 24 点/速算/汉诺塔/N 皇后/数字华容道/数织/球排序/天平/像素对称/七巧板的联网竞速设置、题面/棋盘校验、成绩校验和胜负比较规则；五子棋 PvE 三档均走 [Rapfi](https://github.com/dhbloo/rapfi) 单线程 WASM（`public/gomoku-rapfi/`，Piskvork/Yixin，GPL-3）：入门 STRENGTH≈25%/0.4s、进阶≈60%/1.2s、大师 100%/2.5s（见 `RAPFI_LEVEL_PRESETS`）；`gomoku-ai-client` 进入 PvE 即预加载，失败时回退自研 `gomoku-engine`（仍经 `gomoku-ai.worker`）；PvE 维护有序着法供 YXBOARD，可选执黑/执白（执白时 AI 先手）；在线五子棋共享房间/棋盘类型、空棋盘构造和房间码生成，落子权威逻辑由数据库 RPC `gomoku_place_stone` 执行；在线记忆翻牌共享主题/难度/牌堆类型和服务端建牌，翻牌权威逻辑由数据库 RPC `memory_flip_card` 执行 |
| `lib/playground/function-wars-*` | `function-plotter.ts`, `function-wars-weapons.ts`, `function-wars-levels.ts`, `function-wars-online.ts`, `function-wars-simulation.ts` | 函数战争共享领域层：tokenizer + 递归下降 AST 安全解析/求值（含隐式乘法、白名单函数、渐近线与阶跃中断检测）、武器/道具参数、3 场景 10 个战役关 + 5 个挑战关关卡库（挑战关含表达式规则、中继器、射击上限、有效射击进度与三星奖励目标），以及确定性对称在线地图/房间快照类型；`function-wars-simulation.ts` 是浏览器预览、回放与服务端权威开火共用的 server-safe 弹道/碰撞实现 |
| `hooks/playground/use-memory-match.ts` | `useMemoryMatch`, `createMemoryDeck` | 记忆翻牌单机牌堆；首屏牌序按主题/难度稳定生成，组件挂载后再随机化，避免 SSR 与客户端首屏随机洗牌造成 hydration mismatch |
| `lib/maps/domestic-leaflet.ts` | `domestic-leaflet.ts` | 自然观察地图共享的 Leaflet 动态加载器与高德栅格瓦片配置；开源引擎随本站 JS 分包加载，浏览器地图数据请求继续走国内高德域名 |
| `lib/utils/` | 文件校验、HTTP 工具、上传、手机号、拼音、自然导航、主题分类；`safe-internal-href.ts` 校验站内 `from`/`next`（允许 `/`，拒绝 `//`、反斜杠与 `..`）；图片上传会按 bucket 在客户端预压缩，其中作品图片 `project-completions` 最长边限制为 1600px、目标不超过 0.9MB，降低多图作品加载量；`bounded-ttl-map.ts` 提供无定时器、带 TTL 与容量上限的进程内 LRU，避免用户/IP 维度缓存随长期流量无限增长 |
| `lib/supabase/fetch.ts` | `fetch.ts` | 服务端 Supabase 请求统一 12 秒可配置超时（`SUPABASE_FETCH_TIMEOUT_MS`），避免 DNS/上游故障期间请求对象长期堆积；服务端与 service-role 客户端均复用 |
| `lib/auth/` | `server.ts`, `login-redirect.ts` | 服务端认证辅助；`requirePageUser()` 默认按 proxy 转发的当前路径生成 `/login?next=...`；`/settings/about` 视为公开设置页 |
| `lib/testing/` | `playwright-smoke.ts` | E2E 测试辅助 |
| `lib/membership.ts` | `membership.ts` | 会员档位/周期、有效性判断与 AI 代币常量（免费 5 次/天、会员月发 1500 代币、图文扣费 1/2） |
| `lib/courses/` | `types.ts`, `lesson-types.ts`, `building-lesson-flow.ts`, `device.ts`, `scratch-messages.ts`, `scratch-validate.ts`, `scratch-hints.ts`, `scratch-step-check.ts`, `progress.ts`, `config.ts`, `reconcile.ts` | 技能课程课时类型（scratch / building_3d / playground / reading / video / quiz）、课时步骤可选结构化图解类型（目前 `gomoku_board` 支持黑白子、候选点、辅助线、获胜线），`building-lesson-flow.ts` 将积木课 PPT、动画和真实 3D 步骤归一成侧栏与工作区共用的连续课程流，3D 步骤 `cameraHint` 支持 front/back/side/top/isometric 视角、课程内容可用 `learningGoals` / `teacherGuide` 声明学习目标与教师/家长引导、根级 `workSubmission.enabled` 控制该课是否支持直接发布作品；`building_3d` 内容优先用 `ldrawModelUrl` 指向自托管 LDraw `.mpd` 模型，模型内 `0 STEP` 驱动分步显隐，可选 PPT 逐页图、动画、历史搭建说明和成品图；`brickInstances` 仅作为历史/开发兜底，不用于新增大颗粒课程；`progress.ts` 负责空课/匿名/排序稳定的课程进度纯计算、完成反馈和 DTO 映射，`config.ts` 统一 Admin 与运行时 STEAM 权重校验，`reconcile.ts` 触发服务端补偿；其余文件负责设备能力判断、Scratch iframe postMessage 协议、`.sb3` 积木校验、小迪 Scratch 积木提示与当前步骤自检（opcode、字段/输入值和连接关系） |
| `lib/works/` | `types.ts`, `capability.ts`, `data.ts`, `submission.ts` | 统一作品领域层：判断课时是否支持作品、读取/映射项目完成作品与课程课时作品、提交课程作品、按来源补齐课程或项目信息；详情查询允许公开已审核的项目过程记录，按探索会话读取最近 50 条并返回完整计数，无 `exploration_id` 的历史记录只回退当前记录；首页趋势作品和个人主页 API 仍只读取终稿 |
| `lib/ai/tutor/` | `engine.ts`, `prompt.ts`, `student-profile.ts`, `context-builders.ts`, `untrusted-text.ts`, `course-catalog.ts`, `gomoku-facts.ts`, `reply-focus.ts`, `audio-tags.ts`, `species-catalog.ts`, `species-hints.ts`, `memory.ts`, `greeting.ts`, `resolve-context.ts`, `tool-calls.ts`, `tool-registry.ts`, `tool-call-planner.ts`, `scratch-screenshot-diagnosis.ts`, `resource-search-planner.ts`, `resource-search.ts`, `scene-capabilities.ts`, `speech.ts`, `mascot-state.ts`, `golden-set.ts` | AI 导师小迪：`engine.ts` 纯文本默认低延迟 `qwen-flash`（`DASHSCOPE_TUTOR_TEXT_MODEL` 可覆盖），图文走 `DASHSCOPE_TUTOR_VISION_MODEL` / `DASHSCOPE_VISION_MODEL`，工具决策 planner 走 `DASHSCOPE_TUTOR_PLANNER_MODEL` / `DASHSCOPE_FLASH_MODEL`；complete/stream 走共享 `lib/ai/dashscope.ts`（非流式 20s / 流式 120s，超时映射为友好错误）、`stream_options.include_usage`，并通过 `onTelemetry` / `onVisionFallback` 回传模型名、token usage 与视觉降级信号，视觉降级重试会在消息里注明「图片没能加载成功」，禁止模型假装看过图；`untrusted-text.ts` 提供 `sanitizeTutorUGC`，学生/社区可编辑文本（阶段笔记、项目标题/描述、观察记录、角色名、昵称、周计划项目名等）进入 system prompt 前统一去控制字符、中和 chip/积木/音频标记语法并限长；`memory.ts` 两层记忆：用户级笔记本（上限按累计消息量 600/900/1200 字放宽，写入用 `last_message_id` 乐观并发、首建 `ignoreDuplicates` upsert，防止并发摘要互相覆盖）+ 会话级滚动摘要（`tutor_conversations.summary` 约 400 字，折叠滑出 12 条上下文窗口的旧消息，锚点 `summary_message_id` 乐观并发，POST 落库后 `after()` 后台更新，下一轮注入 system prompt【本次对话早前摘要】）；`student-profile.ts` 只构建当前登录用户的安全画像摘要与「个人中心可见范围」（能力雷达、累计统计、近期活动、成长任务、课程/PBL 进度、徽章、游乐场战绩、作品反馈、AI 额度），扩展信号查询失败时降级为空，并列出不可见隐私；资料 PATCH 成功后调用 `invalidateStudentProfileCache`，使昵称/简介/生日等改动在下一轮对话立即生效；`prompt.ts` 约束小迪被问到个人中心/能力雷达时只引用摘要、不可声称能看完整后台或未列出数据，并要求习题、测验、谜题、棋盘/闯关题使用逐层线索而非直接给最终答案、选项、完整解法或精确落点，且场景「事实要点」须照抄、不得用「尚未证明」覆盖；站内推荐用 `[project:ID|标题]` / `[course:ID|标题]` 可点击 chip（前端 `tutor-message-content` 渲染到 `/project` 或 `/courses`）；`course-catalog.ts` 在 POST 对话时向前置注入已上架技能课程目录，任意页面问课都能引用；`gomoku-facts.ts` 向 playground surface 与五子棋课程场景注入本站自由五子棋规则、「15×15 无禁手黑必胜已证明」、以及《五子棋博弈论入门》推荐口径（问课不得说没有，有 id 时强制带 `[course:…]`）；`speech.ts` 封装语音输入/输出：TTS 默认 `qwen3-tts-flash` + `Ethan`，流式朗读走 `qwen3-tts-flash-realtime`（`DASHSCOPE_TUTOR_TTS_REALTIME_MODEL` 可覆盖）同一条 DashScope Realtime WebSocket；ASR 默认 `qwen3-asr-flash-realtime`，均复用 `DASHSCOPE_API_KEY` 且可用 `DASHSCOPE_TUTOR_*` 环境变量覆盖；HTTP TTS 合成与音频下载均 20s 超时，realtime TTS 连接 10s / 会话 120s，超时映射为 504；流式清洗会扣住未闭合的 chip/markdown 再送 TTS；服务端 ASR 使用生产依赖 `ws` 在 WebSocket 握手时发送 DashScope 鉴权头，并在异常断开时立即失败；`mascot-state.ts` 合成 FAB 吉祥物可见态（listening > error/success > working > speaking > thinking > idle）；…物种对话时按提及物种注入「常见环境」（habitat_notes）与「本站公开观察记录」（topLocations 聚合），并约束不要把学生/站内地名观察说成「常见于XX」；`species-catalog.ts` 按 `id` 分页拉全量活跃物种（每页 500，10 分钟 TTL；中途失败不缓存残缺结果），名称匹配只缩小候选集合，观察地点并行查询；`POST /api/tutor/chat` 将历史加载与物种音频查询并行、资源检索与 planner 批重叠，鸟鸣 planner 与主回复流并行（回复出现新音频候选才重规划），退款失败会 `logger.warn`；课时/阶段/扫雷 UI 交互使用白名单 tool call，`scene-capabilities.ts` 定义前后端共享的 scene capability 契约（如 `focusCourseLessonStep`、`focusChallengeStage`、`hintMinesweeperCell`），`context-builders.ts` 会按场景产出服务端 capability 上限（例如课程课时默认带 `focusCourseLessonStep`、PBL 阶段默认带 `focusChallengeStage`、只有 playground 的 `minesweeper` gameKey 默认授权扫雷提示，迷宫等其他 gameKey 不带扫雷 capability），POST 规划时再与前端当前真实挂载的 handler capability 取交集；`tool-registry.ts` 先按当前 scene 与 capability 限定可用工具，`tool-call-planner.ts` 和 `scratch-screenshot-diagnosis.ts` 由模型判断是否执行页面动作，`resource-search-planner.ts` 由模型判断是否检索站内资源，`audio-tags.ts` 由模型判断是否附加鸟鸣；`tool-calls.ts` 仅保留工具名称和 payload 类型，不再用正则做“卡住/下一步/反馈”确定性判断；Scratch 课时会结合当前步骤、服务端归一化后的 pending `targetItemIndex` 游标和原始子动作数，决定是停留当前子动作、切到同一步下一个积木动作，还是进入下一课时步骤；扫雷工具 payload 不携带棋盘，前端 handler 在本地运行公开状态推理并只高亮证据数字格；`reply-focus.ts` 会把本轮页面工具焦点插到模型场景最前面，确保 Scratch 文本回复和高亮目标一致，并避免扫雷回复编造浏览器本地才知道的坐标或直接给答案；planner 失败时不触发页面工具、截图不触发高亮、音频不附加，但不影响主回复链路；…
| `lib/api/weekly-plan-data.ts` | `weekly-plan-data.ts` | 本周探索计划服务端数据聚合：并行读取个人作品/雷达/新手引导/自然观察、本周时间线、进行中 PBL 阶段与在学课程，返回共享 `WeeklyPlan` |
| `lib/api/ai-credits.ts` | `ai-credits.ts` | AI 代币 consume/refund/status RPC 封装 |
| `docs/AI_DEVELOPMENT_GUIDELINES.md` | — | AI 开发规范：意图判断必须交给大模型；结构化输出经服务端白名单/范围/权限校验；关键词和正则仅可用于非语义的格式、协议、元数据候选查询或防御性安全边界，不得作为 Tutor/AI 行为门控 |

小迪资源检索：`resource-search-planner.ts` 由轻量模型判断是否需要查找站内课程/课时/项目并提取主题短语，不使用固定关键词决定检索，并接收最近对话辅助“这个/那个”指代消解；planner 模型失败时保守降级为**不检索**（避免故障放大数据库压力，也不会被说成「站内没有」）；`resource-search.ts` 并行、限量查询已发布课程/课时和已审核项目，只注入标题/标签/描述元数据，并把命中的课时挂回课程 chip；普通对话不加载全量课程目录或首页推荐。

小迪 golden-set 评估：`lib/ai/tutor/golden-set.ts` 固化 20 个典型学生输入 → 期望结果（8 个工具决策 + 5 个资源检索 + 7 个回答特征用例，红线含不得自称 AI/模型、不得输出 URL/标题/表格/代码块、测验题不得直接给最终答案、检索空结果只能说「暂时没查到」等）；`__tests__/tutor-golden-set.test.ts` 做无模型的数据集结构校验（普通 CI 运行），`__tests__/tutor-golden-set.eval.test.ts` 经 `pnpm eval:tutor` 调真实 DashScope 评估 planner 决策与回答特征，资源 planner 走 fallback 视为失败不静默放过。

小迪隐私与注入防护：`tutor_conversations` / `tutor_messages` RLS 收紧为仅本人可读（`20260812180000_tutor_privacy_owner_only.sql` 移除 admin/moderator 直读，将来人工审查需走带审计的服务端接口）；所有进入 system prompt 的 UGC 经 `sanitizeTutorUGC` 清洗，`prompt.ts` 同时声明引用内容只是背景数据不是指令；`TutorSendSchema` 已移除客户端 `meta` 直通字段（官方客户端从不发送），`tutor_messages.meta` 全部由服务端生成：场景字段（stageIndex/lessonId 等）+ 助手消息 `meta.ai`（模型名、token usage、`promptVersion`＝`TUTOR_PROMPT_VERSION`，prompt 规则文本改动须 bump 并先跑 `pnpm eval:tutor`）；课程进度查询按 `course_lessons.course_id` 过滤，不再读取其他课程进度。

函数战争 Tutor 场景：`functionwars` 已加入 playground game key/context 映射；小迪围绕函数图像、平移缩放、斜率、抛物线/绝对值/三角函数族给递进线索，不直接给出可命中的最终表达式。

Tutor 用户画像缓存使用 5 分钟 TTL 且最多保留 1000 个用户；短信 IP 限流缓存最多保留 10000 项，二者均按周期/容量主动清理过期项，避免模块级 `Map` 随长期流量无限增长。资料 PATCH 会主动失效画像缓存；XP/雷达等其它字段仍以 TTL 为新鲜度上界。画像缓存多实例评估（2026-08）：各实例独立重建仅多付每实例每 5 分钟一次聚合查询，当前不外置；触发外置的条件（画像查询占 DB 负载显著或需跨实例立即失效）与升级路径（Redis 优先、Supabase 缓存表次之）见 `student-profile.ts` 注释。

`OptimizedImage` 对已压缩的 `/projects`、物种图、课程图及其 `/api/assets` 代理地址直接透传，不再交给 Next/Sharp 二次转换；远程用户图统一标记 `unoptimized`，Supabase `supabase.co` 用户图同时改用 Render Transform（含 `cover` 变体），避免 Next/Sharp 为用户 URL/尺寸组合建立无界服务器图片缓存；浏览器与图片源站仍负责客户端/CDN 缓存；空字符串 `src` 不渲染 `<Image>`，避免无封面项目触发整页 preload / 控制台报错。

Scratch 与 Tutor Agent：`scratch-hints.ts` 覆盖课程现有的移动、侦测、变量、运算、控制、外观、声音、音乐和画笔 opcode（含坐标/大小设值、显示/隐藏、等待直到/重复直到、克隆和画笔粗细），供 iframe 打开分类并定位具体 flyout 积木；`scratch-step-check.ts` 复用同一批 hint item，对当前选中 Scratch 对象做步骤自检，能识别 opcode-only 完成、坐标/变量/大小/比较/克隆等可编辑值不匹配，以及带箭头/拼接语义步骤里的未连接积木，并把 pending item 继续供小迪上下文和页面高亮使用；`scratch-screenshot-diagnosis.ts` 仅在 Scratch 课时当前上传截图且学生明确求助/检查时调用视觉模型，并只能以当前步骤候选积木索引返回高置信结论，视觉失败、模糊截图或无结论均不触发 UI；路由仍经 `tool-registry.ts` 校验后才产生高亮 tool call。`tool-call-planner.ts` 只在消息明确请求页面操作时才调用模型规划，普通 Scratch/扫雷知识问答不会触发页面工具，实际工具选择仍走模型与白名单校验。

### 4.10 根级工具文件
- `lib/schemas.ts` — Zod 验证 Schema（项目、评论、讨论等）
- `lib/logger.ts` — 结构化日志工具（`warn` 在服务端始终打印，浏览器生产环境保持静默；`error` 始终打印）
- `lib/rate-limit.ts` — 内存速率限制器
- `lib/utils.ts` — `cn()` 样式合并工具
- `lib/date-utils.ts` — 日期格式化
- `lib/subcategories.ts` — 子分类定义
- `lib/reverse-geocode.ts` — 反向地理编码
- `lib/comment-image.ts` — 评论图片处理
- `lib/completion-records.ts` — 完成记录查询
- `lib/home-featured-slides.ts` — 首页轮播配置
- `lib/messages/message-time.ts` — 私信连续消息时间分组与本地时间分隔格式化

---

## 5. Hooks (`hooks/`)

| Hook | 文件 | 功能 |
|------|------|------|
| `use-danmaku` | `hooks/use-danmaku.ts` | 弹幕系统 |
| `use-follow` | `hooks/use-follow.ts` | 关注/取关逻辑 |
| `use-messages` | `hooks/use-messages.ts` | 私信会话、消息分页、未读数与会话已读 |
| `use-moderator-eligibility` | `hooks/use-moderator-eligibility.ts` | 审核员资格检查 |
| `use-observation-interactions` | `hooks/use-observation-interactions.ts` | 观察记录互动（点赞等） |
| `use-toast` | `hooks/use-toast.ts` | Toast 通知管理 |
| `use-gamification-data` | `hooks/gamification/` | 游戏化数据（徽章、XP、等级）；徽章列表仅在查询成功后才触发自动 `checkBadges` |
| `use-profile-observations` | `hooks/profile/` | 个人观察记录与自然观察进度 |
| `use-2048` 等 | `hooks/playground/` | 18 个游戏逻辑 Hook（记忆翻牌 `use-memory-match` 支持五套图案主题，`use-memory-online` 支持在线房间、轮次、比分和战绩；`use-race-online` 支持通用联网竞速房间、成绩提交、胜负派生和邀请重连） + `use-playground-sync`（登录后以云端 `playground_stats` 为唯一持久化，战绩变更 debounce 上传并 `invalidateQueries` 刷新徽章缓存；遗留 localStorage 仅一次性迁入；同步失败走集中 `logger.warn` 降噪，不直接写浏览器 `console.error`）；各游戏经 `usePlaygroundStatsLoader` 在云同步后重载战绩；在线五子棋/记忆翻牌/函数战争/竞速房间共用 `use-game-room.ts`，优先订阅 Supabase Realtime 并保留 4 秒 HTTP 轮询兜底，竞速通过可选 `fetchMatchViaApi` 走服务端权威读取以推进截止结算；各游戏 `stats` 初始化统一用空 stats，真实战绩挂载后从内存镜像异步加载，避免 hydration mismatch |
| `use-function-wars` | `hooks/playground/use-function-wars.ts`, `use-function-wars-online.ts` | 单人弹道采样、障碍/弹坑/单位/道具/信号中继碰撞、分裂/镜像/钻地行为、任务表达式零消耗校验、有效射击进度与射击上限结算、关卡星级与 `function_wars_stats` 持久化，胜负终局各计一次 `totalGames` 且失败不写通关/最佳记录；在线 hook 复用 `use-game-room` 的 Realtime + 权威 HTTP 轮询重连，开火只提交函数/武器/预期序号，不在浏览器累加胜负；可信在线战绩由 `function_wars_match_results` 派生并从 `playground_stats` 回读 |
| `use-maze-runner` | `hooks/playground/use-maze-runner.ts` | 迷宫支持 9×9、13×13、17×17、21×21、25×25 五档关卡；所有尺寸都会从多张回溯/Prim 候选图中按路线岔路、误导分支、死胡同和路线长度评分，选择更容易出现错误岔路但仍保持唯一解的迷宫 |

---

## 6. 数据库 (`supabase/`)

- `supabase/migrations/` — **290 个**迁移文件；…；AI 导师统一表+笔记本：`20260610150000_tutor_messages_and_notebooks.sql`；小迪物种档案上下文：`20260610170000_tutor_species_context.sql`；小迪对话线程：`20260611140000_tutor_conversations.sql`；小迪对话隐私收紧（仅本人可读，移除 admin/moderator RLS 直读）：`20260812180000_tutor_privacy_owner_only.sql`；小迪会话滚动摘要字段（`summary` + 锚点 `summary_message_id`）：`20260812200000_tutor_conversation_summary.sql`；2026-08-13 站长内容分诊硬删除 105 个项目（不是下架）：`20260813090000_hard_delete_triaged_projects.sql`，权威 ID 列表 `scripts/lib/content-triage-2026-08-13.mjs`，政策说明 `docs/content-triage-2026-08-13.md`，OSS 清理 `scripts/purge-triaged-project-assets.mjs`（默认 dry-run）；AI 代币体系：`20260610151000_ai_credit_system.sql`；PBL 工作台个人化计划：`20260615100000_challenge_workspaces.sql`；在线五子棋对局表/服务端权威落子 RPC/Realtime 策略：`20260625180000_gomoku_matches.sql`、`20260625180100_gomoku_realtime_publication.sql`、`20260625180200_gomoku_realtime_channel_policy.sql`，RPC JSONB 路径类型修复：`20260627145000_fix_gomoku_jsonb_path_casts.sql`；五子棋博弈论入门课程种子与扩写（lesson_type=playground，结构化棋盘图解，不含外部参考资源链接）：`20260626140000_seed_gomoku_course.sql`、`20260626150000_enrich_gomoku_course.sql`；学前大颗粒积木工程启蒙课程种子与 12 课时扩展（lesson_type=building_3d，原创高塔/小车/小桥/动物小屋/坡道/齿轮/跷跷板/迷宫/花园/吊车/风车/小乐园内容，含 `learningGoals`、`teacherGuide`，后续统一切到自托管 LDraw `.mpd` 模型）：`20260627170000_seed_preschool_brick_engineering_course.sql`、`20260627172000_expand_preschool_brick_engineering_course.sql`、`20260627173000_preschool_brick_ldraw_models.sql`；学前大颗粒积木课程重做为公开 STEAM 方向下的原创 12 课（稳稳高塔、小车跑直线、小桥承重、动物小屋、高低平台、转向指针、左右平衡桥、迷宫路线、规律花园、升降高塔、十字转盘、积木小乐园），并保留每课自托管 LDraw 模型：`20260627174000_redesign_preschool_brick_curriculum.sql`；已执行环境的现实搭建修复与官方参考资源回填：`20260628125000_fix_preschool_brick_realistic_lessons.sql`；把「大颗粒积木工程启蒙」第一课「会跑的小车」替换为「埃菲尔铁塔」样板课（13 步严格对照搭建说明 PDF 的 13 页：外八字腿→蓝红交替分层→双层灰平台→收窄塔身→中央蓝红条纹塔尖；动画 mp4 + 搭建说明 PDF + 自托管 LDraw `eiffel-tower.mpd`，源 `.ldr` 已移除，课程继续使用已完成的 `public/courses/ldraw/eiffel-tower.mpd`，不再保留描述生成器入口，资源本地 `public/courses/eiffel-tower/`）：`20260628140000_replace_first_brick_lesson_with_eiffel.sql`；随后将埃菲尔样板课落点改到「小小积木工程师：学前大颗粒启蒙」第 1 课（原「稳稳高塔」→「埃菲尔铁塔」），并把「大颗粒积木工程启蒙」第一课还原回「会跑的小车」：`20260628150000_move_eiffel_to_preschool_lesson1.sql`；课件100「抽屉」「大象」「大熊猫」「灯塔」「电话机」「电影院」「东方明珠」课时挂载本地 LDraw 模型/对齐 3D 步数：`20260705150000_lesson_37_chou_ti_ldraw_model.sql`、`20260705153000_lesson_38_elephant_ldraw_model.sql`、`20260705154000_lesson_39_panda_ldraw_model.sql`、`20260705155000_lesson_40_lighthouse_ldraw_model.sql`、`20260705160000_lesson_41_telephone_ldraw_model.sql`、`20260705162000_lesson_42_cinema_ldraw_model.sql`、`20260705161000_lesson_43_dong_fang_ming_zhu_ldraw_model.sql`、`20260705163000_lesson_43_dong_fang_ming_zhu_steps.sql`；埃菲尔铁塔 LDraw 课程字段刷新：`20260705164000_eiffel_tower_ldraw_refresh.sql`；课件100「购物车」「柜子」「蝴蝶」「滑滑梯」「火箭」「急救包」「奖杯」「警车」「跨海大桥」「拉杆箱」「凉亭」「溜冰鞋」「轮船」「马车」「毛毛虫」批量挂载 LDraw MPD：`20260726123120_mount_more_3plus_ldraw_models.sql`；溜冰鞋 150 件 Studio 模型步骤数修正：`20260728141000_fix_roller_skates_ldraw_steps.sql`；个人资料 `profiles.bio` 明确建列与 Realtime `messages` 复制读取授权修复：`20260626211500_profiles_bio_column.sql`、`20260626211600_realtime_messages_select_grant.sql`；免费配额退款修复：`20260610160000_fix_ai_free_refund.sql`；函数 search_path 安全加固：`20260627150000_lock_function_search_path_empty.sql`（把全部 public schema routine 锁定到 `search_path = ''`，真正消除 Database Linter `function_search_path_mutable` 告警；先 `CREATE OR REPLACE` 重写 5 个含未全限定表/视图引用的函数补 `public.` 前缀，再用幂等 DO 块批量 ALTER 其余 routine；历史 `20260305100000` / `20260523140000` 用 `public` 不被 linter 接受；审计工具 `scripts/audit-function-search-path.mjs`）；统一课程/项目作品模型与近期互动排行 RPC：`20260710190000_unified_course_and_project_works.sql`（课程作品直接关联 `course_lesson_id`、迁移并归档历史背书项目、审核通过作品 +20 XP）；课程进度/可信完成来源/能力里程碑/原子奖励与稳定雷达：`20260731100000_course_progress_rewards_and_steam.sql`（`user_course_completions`、`record_course_lesson_completion`、`reconcile_course_completions`、`approve_completion_with_reward`、`system_approve_completion_with_reward`、`repair_completion_rewards`，收紧 `user_lesson_progress` DML 并过滤 STEAM 活动来源；需先配置预检，再 `pnpm db:push` 应用）
- 本次新增自然观察图鉴 RPC：`20260731113000_observed_species_atlas_rpc.sql` 提供无 user id 的 `get_my_observed_species_ids()`，按 approved 观察、社群共识优先和 AI 置信度 `>= 0.8` 兜底返回当前用户物种点亮集合；应用迁移使用 `pnpm db:push -- --dry-run`、`pnpm db:push`、`pnpm db:status`，不要使用 `supabase db push`
- 本次新增互动资格与安全 XP 迁移：`20260801090000_interaction_access_and_secure_xp.sql` 增加 `profiles.interaction_restricted`，清空历史自动确认，提供社区互动确认 `confirm_my_age()` 与 service-role-only 固定奖励 `award_xp_once()`；应用使用 `pnpm db:push`，不要使用 `supabase db push`
- 本次安全加固迁移：`20260803120000_harden_interaction_access_and_xp.sql` 撤销旧 XP RPC 的公开执行权、禁止客户端写 `xp_logs`，通过 `current_user_can_interact()` 与数据库触发器封住项目/评论/投稿/观察/消息/互动/进度的直接写入绕过，并在 `award_xp_once()` 内恢复项目评论每日 50 XP 上限；迁移末尾通知 PostgREST reload，应用使用 `pnpm db:push`
- 本次新增社区安全治理迁移：`20260804120000_community_safety_governance.sql` 增加 `user_blocks`、`moderation_cases`、`safety_actions`、`safety_appeals` 与账号安全投影；项目、讨论、评论、完成作品、自然观察、挑战投稿和私信增加 `moderation_state`，公开读取仅允许 `approved`，本人/审核员仍可查看审核态；举报可自动隐藏高风险内容，安全处罚支持互动限制、停用、封禁与有效期内申诉，证据按保留期清理；应用使用 `pnpm db:push`，不要使用 `supabase db push`
- 本次私信门禁调整迁移：`20260806100000_allow_messages_before_confirmation.sql` 保留账号限制、屏蔽、隐私、频率限制和内容审核，移除私信对社区互动确认的依赖；应用使用 `pnpm db:push`，不要使用 `supabase db push`
- 本次安全审核阻塞修复迁移：`20260807100000_repair_moderation_rpc_search_path.sql` 补齐稳定的 `is_moderator_or_admin()` 权限 helper，并修复项目/作品拒绝与审核日志 RPC 在空 `search_path` 下的未限定函数调用；收紧审核 RPC 执行权限，应用使用 `pnpm db:push`
- 本次审核 RPC 权限补丁：`20260807103000_restrict_moderation_rpc_execute.sql` 清除旧函数上遗留的匿名显式执行授权，仅保留登录用户和 service role 执行审核动作；应用使用 `pnpm db:push`
- 本次安全处罚投影修复：`20260810113000_sync_safety_projection_rpc.sql` 通过仅 service role 可执行的 `SECURITY DEFINER` RPC 同步 `safety_actions` 到账号安全状态和 `interaction_restricted`，并回填历史投影；应用使用 `pnpm db:push`
- 本次项目卡作品数迁移：`20260810190000_project_completion_counts_batch.sql` 增加公开终稿作品的项目维度部分索引和 `get_project_completion_counts_batch()` 批量 RPC；函数使用调用者权限并显式过滤 `is_public/status/moderation_state/record_kind`，应用使用 `pnpm db:push`
- 本次作品审核奖励修复：`20260810200000_fix_completion_reward_uuid.sql` 让审批与奖励修复 RPC 的 XP 流水变量跟随 `xp_logs.id` 的 UUID 类型，恢复终稿自动/人工审核与幂等 `+20 XP`，并移除相关内部 RPC 遗留的匿名执行授权；应用使用 `pnpm db:push`
- 本次过程转终稿迁移：`20260810210000_promote_progress_completion_to_final.sql` 增加仅本人可调用的 `promote_progress_completion_to_final()` 事务 RPC；只允许把已公开审核的项目过程记录设为终稿，并原子处理终稿唯一性、幂等奖励与探索会话完成状态；应用使用 `pnpm db:push`
- 本次内容分诊硬删除：`20260813090000_hard_delete_triaged_projects.sql` 按站长 2026-08-13 审定的 105 个项目 ID 永久删除（不是下架），并先清子表/关联行；权威名单与保留 ID 见 `scripts/lib/content-triage-2026-08-13.mjs` 与 `docs/content-triage-2026-08-13.md`；OSS 图由 `scripts/purge-triaged-project-assets.mjs` 另跑（默认 dry-run）。应用使用 `pnpm db:push`，不要从 cloud agent 对生产执行删除。
- 大颗粒课程的面向用户名称与课程卡文案：`20260722185000_rename_courseware_courses.sql`、`20260723100500_refresh_courseware_descriptions.sql`、`20260723101500_clarify_courseware_age_descriptions.sql`；三档课程统一使用“适合 N 岁以上”的明确年龄表达，强调 100 个主题、课件/动画与分步引导，不再在课程介绍中暴露后台保留的 PDF 资源。
- 本批课程数据修复：`20260728141000_fix_roller_skates_ldraw_steps.sql` 将「溜冰鞋」同步为用户确认的 150 件 Studio 模型和 13 项课程步骤；`20260728143000_fix_butterfly_ldraw_steps.sql` 删除「蝴蝶」BOM/成品页造成的伪步骤，将侧栏与 3D 模型统一为 10 个实际搭建步骤；`20260728144000_restore_lesson_32_animation.sql` 恢复 lesson 32「长颈龙」在课件第 5 页的 `animation.mp4`，对应课程流 `?step=3`。
- `supabase/seed.sql` — 种子数据入口
- 课程进度与奖励边界：`user_lesson_progress.completion_source` 区分历史/可信完成，`user_course_completions` 保存每用户每课程一次的不可变 STEAM 快照；完成、补偿和审核奖励分别通过 service-role `record_course_lesson_completion`、`reconcile_course_completions`、`approve_completion_with_reward` / `system_approve_completion_with_reward` 原子处理，`repair_completion_rewards(false)` 默认只审计缺失奖励，显式传 `true` 才修复。
- 本批新增在线记忆翻牌迁移：`20260714190000_memory_matches.sql`（`memory_matches` + `memory_flip_card` RPC，客户端直接 UPDATE/DELETE 禁用，权威写入走 RPC/API service role）、`20260714190100_memory_realtime_publication.sql`、`20260714190200_memory_realtime_channel_policy.sql`（私有 Realtime channel）
- 本批新增通用竞速房间迁移：`20260714190300_playground_race_matches.sql`（`playground_race_matches`，客户端直接 UPDATE/DELETE 禁用）、`20260714190400_playground_race_realtime_publication.sql`、`20260714190500_playground_race_realtime_channel_policy.sql`（私有 Realtime channel）、`20260715113000_playground_race_game_keys.sql`（扩展 `game_key` 约束以支持 24 点和数字华容道）、`20260715164600_playground_race_lifecycle.sql`（`deadline_at` / `finish_reason`、活跃 deadline 部分索引、等待 15 分钟/开局 30 分钟超时结算 RPC、截止前原子成绩提交 RPC；函数仅授权 service role）
- 本批新增函数战争迁移：`20260715180000_function_wars_matches.sql`（`function_wars_matches`、服务端轮次/弹药/伤害边界校验的 `function_wars_fire`、超时推进 RPC、参与者 RLS 与客户端直接 UPDATE/DELETE 禁用）、`20260715180100_function_wars_realtime_publication.sql`、`20260715180200_function_wars_realtime_channel_policy.sql`（私有 Realtime channel）、`20260716103000_function_wars_authority_lifecycle.sql`（撤销浏览器执行旧开火 RPC，新增服务端权威开火/预期序号校验、连续两次超时判负、不可变赛果与可信在线战绩回写）、`20260717100000_function_wars_active_match_invariant.sql`（参与者 advisory lock 强制单活跃对局，并按固定 UUID 顺序刷新双方战绩以规避反序死锁）；均需 `pnpm db:push` 应用
- `supabase/scripts/prepare_migration.sql` — 迁移准备脚本

### 核心数据表
`profiles`（含 `membership_tier` / …） · **`user_blocks`**（双向用户屏蔽关系） · **`moderation_cases`**（自动审核、举报和人工审核案件） · **`safety_actions`** / **`safety_appeals`**（账号安全处罚与申诉） · … · **`species`**（自然观察物种，含 `nature_topic` 与植物属性 `life_form` / `cultivation_status` / `plant_uses`） · **`gomoku_matches`**（在线五子棋对局，`board`/`moves` JSONB 快照，落子走 `gomoku_place_stone` RPC） · **`memory_matches`**（在线记忆翻牌对局，`deck`/`scores` JSONB 快照，翻牌走 `memory_flip_card` RPC） · **`playground_race_matches`**（通用联网竞速房间，按 `game_key/settings` 固定规则并保存 host/guest 成绩 JSONB，`deadline_at` / `finish_reason` 记录权威截止和终态原因） · **`tutor_conversations`**（小迪对话线程，active/archived，含会话滚动摘要 `summary` / 锚点 `summary_message_id`） · **`tutor_messages`**（小迪统一对话消息，归属 conversation） · **`tutor_notebooks`**（小迪长期记忆摘要） · **`ai_credit_wallets`** / **`ai_credit_logs`**（AI 代币钱包与流水） · **`challenge_stage_progress`** · **`challenge_workspaces`**（PBL 个人项目方向与个人化计划） · …

完整类型定义：`lib/supabase/types.ts`

`profiles.age_confirmed_at` 仅由社区互动确认流程写入，当前只控制公开投稿/评论/发帖等内容写入；私信仍通过同一 `current_user_can_interact()` 触发器检查账号限制，但不要求该字段。`profiles.interaction_restricted` 由后台限制流程使用；固定 XP 事件通过 service-role-only `award_xp_once()` 原子写入 `xp_logs` 与 `profiles.xp`，项目评论每日最多计入 50 XP。

函数战争新增 **`function_wars_matches`**：保存对称地图种子、双方 HP/弹药/增益、共享弹坑/道具、当前回合、连续超时数与单调 `shot_seq`；参与者 advisory lock 触发器保证每个用户最多出现在一个 `waiting/playing` 对局。浏览器不能直接执行内部 `function_wars_fire`，认证 `/fire` API 先用共享模拟器重算摘要，再由 service-role-only `function_wars_fire_authoritative` 在行锁内校验参与者和预期序号后原子换手或结算。**`function_wars_match_results`** 保存不可变的每局赛果，触发器按参与者 UUID 固定顺序派生 `playground_stats.function_wars_stats.onlineGames/onlineWins`，避免并发赛果反序锁行。

---

## 7. Scratch 编辑器子包 (`packages/scratch-host/`)

- 基于 **`@scratch/scratch-gui` 11.x**（官方 scratch-editor 生态）独立 Webpack 构建，与 Next.js 主站 React 19 隔离
- 构建：`pnpm --filter scratch-host build` → `pnpm --filter scratch-host copy-to-public` → 输出到 `public/scratch/`（整目录 gitignore，CI/Docker 的 `pnpm build` 会自动构建）
- Scratch 素材库 `public/scratch/assets/` 已迁 OSS（`scratch/assets/` 前缀）；配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后，各环境 `/internalapi/asset/*` 默认 rewrite 到 `/api/assets/scratch/assets/*` 同源代理（带生产 Referer绕过防盗链并支持本地回退），仅显式 `NEXT_PUBLIC_ASSETS_DISPLAY_MODE=direct` 才直连 OSS；未配置 base URL 时仍走本地 `public/scratch/assets/`
- **素材加载加速**：`scratch-storage` 的 FetchWorker 默认请求 `/chunks/fetch-worker-*.js`，实际在 `/scratch/chunks/`——`next.config.mjs` rewrite + `copy-to-public` 修正嵌套 webpack `publicPath` 为 `/scratch/`，恢复 worker 并行拉造型/声音；`storage-patch` 仅给 worker.get 加超时回退，不再拆掉 worker。素材响应 `Cache-Control: immutable`；host/`index.html` 只在编辑器实际启动时预取默认工程常用 md5；`copy-to-public` 还会补入受版本控制的官方空白舞台 SVG，防止干净部署缺少默认资产；课程介绍页不再预载 18MB GUI/vendor。`deploy/nginx.conf` 对经 `proxy_pass` 的响应启用 gzip，Scratch GUI/vendor/chunk 采用 1 天缓存加后台重验证，避免固定文件名长期滞留旧版本
- 本地开发编辑器：`pnpm --filter scratch-host dev`（:8601），学习页 iframe 默认加载 `/scratch/index.html`
- **持久 iframe**：`app/courses/[courseId]/lessons/layout.tsx` 挂载 `ScratchHostProvider`（`components/features/courses/scratch-host-context.tsx`），同课程课时间复用单一 embed iframe；切课时只 `LOAD_PROJECT`（`force: true`）热换 `.sb3`，避免每次冷启动 `scratch-gui`；离开 `lessons/*` 才卸载 Host。预览页 `playerOnly` 仍用本地 iframe；手机端通过 `useSyncExternalStore` 的稳定服务端快照避免 hydration mismatch，且不挂载完整编辑器
- 与主站通信：`lib/courses/scratch-messages.ts` postMessage 协议（`LOAD_PROJECT` / `LOAD_PROJECT_BUFFER` 支持 `force` 强制覆盖已编辑项目）；保存走 `POST /api/courses/.../project`；切课卸载时 Provider 可静默导出并上传上一课；主站可向 iframe 发送 `HIGHLIGHT_BLOCK_KEYWORDS` / `DISMISS_BLOCK_KEYWORDS`，host 内部显示/关闭积木关键词提示 overlay，并在可解析分类时尝试切换 Scratch toolbox 分类、按 `items.blockIds` opcode 或积木文案滚动并高亮 flyout 里的当前目标积木（含四则运算和角色实时值 reporter）；主站对同一步多积木提示只向 iframe 下发当前 `targetItemIndex` 对应的关键词/item，避免一次只高亮第一个后直接跳步；host 会通过 `EDITOR_CONTEXT` 回传当前选中角色/对象、角色列表、坐标/方向/大小/造型、积木数以及裁剪后的 block 字段、输入、父子/next 连接，课时页再随小迪 POST 注入场景并供“自检这步”使用

---

## 8. 脚本 (`scripts/`)

> **LDraw 发布门槛**：所有 AI/LLM 生成的 `.ldr` 都是不可信草稿。自动碰撞、支撑和依赖校验通过也不代表模型正确；必须由人工对照 PDF、成品图和实物零件，在 Studio 中逐步核对零件号、颜色、方向、连接、悬空/穿模与 BOM 后，才允许打包、迁移或上线。
>
> **哪些课时有 3D 模型**：不维护手写清单，三处事实来源即可——已发布模型看 `public/courses/ldraw/*.mpd`，课时挂载看 `content.building3d.ldrawModelUrl`（`upsert-courseware.mjs` 的 `hasLdrawModel()` 按文件存在与否写入），运行时由 `lib/courses/building-lesson-flow.ts` 的 `hasRealModel()` 决定是否用 3D 步骤替换图片构建区。

| 脚本 | 功能 |
|------|------|
| `db-push.mjs` | 数据库迁移推送工具（push/status/baseline） |
| `course-config-preflight.mjs` | 只读检查已发布课程的 STEAM 权重/难度配置；`--validate` 在结果为空后显式验证迁移中的 `NOT VALID` 约束 |
| `audit-function-search-path.mjs` | 只读审计 public schema 所有 routine 的 `search_path` 现状与函数体内未全限定表/视图引用，评估改成 `search_path = ''` 的安全性（配合 `20260627150000` 迁移） |
| `compress-project-images.mjs` | 压缩目录图片（`COMPRESS_IMAGES_DIR` / `COMPRESS_MAX_SIDE` / `COMPRESS_JPEG_QUALITY`）；`pnpm compress:fruit-images` 压缩水果图集至 1280px |
| `profile-icons-remove-bg.mjs` | 去除 `public/assets/profile-icons/` WebP 烘焙底色并写入透明通道 |
| `fetch-bird-media-from-wikimedia.mjs` | 从 Wikimedia 抓取鸟类图片 |
| `fetch-tree-images.mjs` | 从 Wikimedia 抓取树木图片 |
| `fetch-fruit-images.mjs` | 抓取水果/干果**果实图**（优先 iNaturalist 结果期观测 + Wikimedia 果实关键词搜索）；下载后自动压缩至 1280px |
| `sync-bird-media-to-db.mjs` | 同步鸟类媒体到数据库 |
| `migrate-public-to-oss.mjs` | 上传 OSS 静态资源（物种图、项目图、Scratch 素材库等；支持 `--only=fruits`；`--only=project-covers` 只同步 `public/projects` 根层旧项目封面；`--only=courses` 上传前会把课时 `slides/*` 和 `finished.*` PNG/JPG 转 WebP，避免课件大图原样进 OSS） |
| `purge-triaged-project-assets.mjs` | 2026-08-13 内容分诊：按 `scripts/lib/content-triage-2026-08-13.mjs` 的 105 个项目 ID，从 `projects` / `project_steps` / `comments` 收集图片 URL，只删 Aliyun OSS 上该项目自己的 `projects/generated/` 与 `projects/steps/` 对象；默认 dry-run，`--execute` 才删除；跳过 default-cover、分类共用封面、课件/Scratch/物种图 |
| `build-species-atlas-thumbnails.mjs` | 只读检查或显式 `--write` 生成 160x160、内容哈希 WebP 图鉴缩略图；从 active 物种与现有鸟/虫/树/水果 manifest 取首张有效图，写入 `species-atlas-thumbnails.json`，支持专题/slug 过滤与并发控制；缩略图经独立 `*-atlas` 组上传 OSS |
| `fetch-scratch-assets.mjs` | 镜像 Scratch 素材库到本地，再经 migrate 脚本上传 OSS |
| `ldraw-models/` | 大颗粒 LDraw 源模型目录：人工核验后的 `.ldr` 是唯一模型源，课程 `.mpd` 只由通用 `pack-ldraw-model.mjs` 从对应 LDR 生成，目录不保留模型专用 generator、assembly/BOM/report 或生成产物专项测试；人工改过 LDR 后先跑 `.agents/skills/image-to-ldraw/scripts/check-ldr-collision.mjs`，再用 `pack-ldraw-model.mjs` 打包；新增零件必须先确认真实零件号并把可再分发的真实 `.dat` 及依赖闭包落到 `parts|p/`，零件号、形状或替代关系不确定时问用户，不允许按描述自造件或用相似件替换；已完成模型的逐课验收细节（对照 PDF、每步件数、零件号与位姿修正、验证等级）见 `docs/ldraw-model-audit.md` |
| `.agents/skills/image-to-ldraw/` | 图纸/照片→assembly→LDraw 的重建技能与可复用约定：`references/reconstruction-review.md`（源图优先重建与解析、分步视觉、Studio 打开三道独立门槛）、`missing-part-workflow.md`（缺件先找真实件，必要时问用户）、`duplo-ldraw-conventions.md`（侧搭模型坐标，层间距用 `part-metadata.json` 的 `heightLdu` 推导而不是写死 ±48/±24）、`thickness-review.md`（砖/板厚度像素测量与截图复核）；`scripts/` 下有 `validate-assembly.mjs`（每个占位强制显式 `support` + 真实碰撞检测）、`check-ldr-collision.mjs`、`preview-model.mjs`（`--step`/`--view`）等工具 |
| `export-courseware-slides.mjs` | 批量把 `C:\Users\Administrator\Documents`（WSL 路径 `/mnt/c/Users/Administrator/Documents`）下的 3+/4+/5+ 课件 PPTX 导出到 `public/courses/<grade-pinyin-slug>/slides/slide-*`：先从 PPTX 包统计真实页数，跳过已完整目录，渲染到临时目录成功后再替换目标 `slide-*`，默认把 PNG/JPG 转 WebP 并刷新已有 `scripts/courseware/<slug>.json` 的 `slideImageUrls`；支持 `--dry-run`、`--force`、`--only=`、`--limit=`、`--upload`（只上传 WebP slides 到 `oss:courses/<slug>/slides/`，默认覆盖旧对象以修复早期单页导出）、`--skip-existing-upload`、`--no-webp`；LibreOffice 在沙箱/无图形后端环境可能失败，需在可用图形后端或沙箱外执行 |
| `import-courseware.mjs` | 课件文件夹→线上课程「资源管线」：按扩展名+关键词识别 PPT/视频/PDF/成品图 → 调 `pptx-to-slides.mjs` 切图（或 `--slides-dir`/`--build-slides-from-source`；后者会先生成到临时目录，成功后再替换已有 `slide-*.png/webp`，失败不动旧文件；默认导入时如自动切图失败但 `slides/` 已有多张图，会沿用现有幻灯片继续产出草稿）→ 幻灯片转 WebP → 视频/PDF/成品图归一化到 `public/courses/<slug>/` → 可选 `--upload` 推 OSS → 产出 `scripts/courseware/<slug>.json`（building3d 内容草稿默认写入 `content.workSubmission.enabled=true`，steps/steps3d/LDraw 留空待人工/LLM 补；`videoSlideIndex` 可直接从 PPTX 关系文件探测，不依赖 LibreOffice 成功渲染）；不再创建背书项目或生成每课迁移；用法 `node scripts/import-courseware.mjs <课件文件夹> --slug=<slug> [--course= --lesson= --upload --no-webp --build-slides-from-source --dry-run]`；编排见 `.agents/skills/import-courseware` |
| `migrate-course-oss-images-to-webp.mjs` | 一次性把 OSS `courses/<slug>/slides/*.{png,jpg,jpeg}` 与 `courses/<slug>/finished.{png,jpg,jpeg}` 替换成同路径 `.webp`：列 OSS（若无 `ListBucket` 权限则从 Supabase 现有 URL 反推清单）→ 下载旧图（`--source=auto|oss|cdn`，OSS `GetObject` 被拒时可带 Referer 从 `NEXT_PUBLIC_ASSETS_BASE_URL` 读 CDN）→ sharp 转 WebP → 上传 `.webp` → 尝试删除旧对象（无 `DeleteObject` 权限时记录 `deleteSkipped` 并继续）→ 同步改 Supabase `course_lessons.content`/`courses.image_url`/背书 `projects.image_url` 与本地 `scripts/courseware/*.json`；必须显式 `--dry-run` 或 `--apply`，支持 `--only=`、`--quality=82`、`--concurrency=`、`--keep-originals`、`--no-db`、`--no-json`；`--cleanup-legacy --apply` 可在 WebP 已验证存在后按当前 WebP 引用反推并删除旧 PNG（需 OSS `DeleteObject` 权限）；需要 `ALIYUN_OSS_*` 与 Supabase service role 环境变量 |
| `upsert-courseware.mjs` | 300 课 MVP 批量上线（跳过 LDraw）：`--prepare` 改 JSON（OSS 绝对 URL、占位 steps、PPTX 探测 `videoSlideIndex`、去掉无模型 LDraw 引用）→ `--upload-assets` 只补传 `instructions.pdf`/`animation.mp4`/`finished.png`（slides 已传则 skip）→ 默认幂等 upsert 小班/中班/大班三门大颗粒积木课 + 300 `building_3d` 课时到 Supabase（兼容历史 3+/4+/5+ 课件 JSON 标题，pg/query）；`--dry-run`、`--only=<slug>` |
| `check-courseware-oss.mjs` | 用 OSS `headObject` 核对 300 课 WebP slides / PDF / video / WebP finished 是否已上传（图片检查 WebP，迁移前兼容旧 PNG 作为 legacy fallback；绕过 CDN 防盗链）；输出汇总 stats |
| `pptx-to-slides.mjs` | 一键把授课 `.pptx` 导成课件翻页器用的 `slide-01.png …`：LibreOffice(`soffice`) 转 PDF → poppler(`pdftoppm`) 切页 → 规范命名拷到课时 slides 目录，并探测内嵌视频在第几页提示设 `videoSlideIndex`。在部分环境无可用显示/图形后端时（常见于无桌面的容器/最小 WSL）会直接失败并提示补齐 `Xvfb/虚拟显示`；如仅已有 `slide-01.png` 会按占位图告警并提示补齐。需 `sudo apt install -y libreoffice poppler-utils fonts-noto-cjk fonts-wqy-zenhei`（中文字体必装，否则中文渲染成「□」豆腐块，脚本会预警）；用法 `node scripts/pptx-to-slides.mjs <input.pptx> [输出目录] [--dpi=150]` |
| `normalize-slides.mjs` | 当已有现成幻灯片图（如手动从 PowerPoint 导出的 PNG）时，按文件名数字自然排序规范成 `slide-01.png …` 拷到课时 `public/courses/<lesson>/slides/`；用法 `node scripts/normalize-slides.mjs <源目录> [输出目录]` |
| `pack-ldraw-model.mjs` | 把 `scripts/ldraw-models/*.ldr` 递归抓取依赖打包成单个自托管 `.mpd` + `LDConfig.ldr` 到 `public/courses/ldraw/`（大颗粒积木 3D 课用，零件库 CC BY / CCAL）；打包时优先使用 `scripts/ldraw-models/parts|p|models/` 本地自定义件，再复用已提交 `.mpd` 内联依赖作为缓存，最后联网抓取；会规范输入 LDraw 文本的 LF/行尾空白，并移除 Studio 导出的外层 `0 FILE ...` / 末尾 `0 NOFILE` 包装，由输出名统一生成 MPD 主模型块，避免 `0 NOFILE` 被课程步骤解析为额外空步骤；用法 `node scripts/pack-ldraw-model.mjs <source.ldr> <outName>` |

---

## 9. 测试

- `__tests__/` — **50+ 个** API 路由单元测试 + 组件测试
- `__tests__/api.playground-race-rooms-route.test.ts` — 竞速加入竞争的前读/条件更新两种交错顺序、同访客重试幂等和等待房间权威超时读取
- `e2e/` — Playwright 冒烟测试（`smoke.spec.ts` 覆盖主要公共页、登录，以及联网邀请未登录时 `next` 保留 `room` 参数）、真实 Supabase 集成测试（`core-flow.spec.ts` 覆盖创建项目及项目页不再出现评论入口，结束时按显式项目 ID 和临时作者兜底清理项目/账号；作品评论与屏蔽由邻近组件/API 测试覆盖；`authenticated-routes.spec.ts` 覆盖登录态路由/权限，`safety-governance.spec.ts` 用三账号覆盖敏感内容拒绝、屏蔽后的私信/关注/点赞/收藏阻断、项目评论停用、高风险举报自动隐藏、公开读取过滤、管理员安全队列、互动限制与处罚申诉，helper 会清理临时用户、测试项目及审核/处罚记录；`playground-online.spec.ts` 用三账号覆盖 24 点 UI 建房/邀请加入/双方提交与胜负、并发加入、等待过期、单方提交超时判胜和双方未提交超时取消；`function-wars-online.spec.ts` 用双账号覆盖函数战争 UI 建房/邀请加入、权威开火、活跃对局冲突、刷新重连、回合超时推进、认输结算与可信在线战绩，helper 会清理临时对局/用户）与 `scratch-host/block-highlight.spec.ts`（独立启动 Scratch host，验证 10 个课程核心 opcode 在真实 flyout 中打开并高亮；选中舞台时的运动积木提示会自动切换至角色）
- LDraw 模型链路刻意不做单元测试：模型是一次性人工验收产物（见 `docs/ldraw-model-audit.md`），`lib/utils/ldraw-mpd.ts` 的解析/分步打包与 `/api/courses/ldraw-step` 改动请手动在某个 `building_3d` 课时逐步翻页验证，别为了覆盖率把 three.js `LDrawLoader` 真加载塞进单测（曾占全量套件近一半耗时）
- 各目录内 `*.test.ts(x)` — 就近放置的单元测试；项目探索记录组件覆盖作品详情留言引导、预览卡和完整记录流的终稿直达作品页、过程记录不误显作品入口，以及作品留言/多级回复的独立举报与自有内容隐藏举报
- `vitest.config.ts` / `vitest.setup.ts` — Vitest 配置
- `playwright.config.ts` / `playwright.integration.config.ts` / `playwright.scratch-host.config.ts` — Playwright 配置；Scratch host 套件与主站 E2E 隔离，避免依赖 Next、数据库或登录

---

## 10. 部署与 CI

- `deploy/docker-compose.yml` — Docker 部署编排；含 `auto-interactions-worker` 后台服务，主站健康后循环调用内部自动互动队列执行接口；主站/worker 分别设有可配置的 cgroup 内存上限与 Node heap 上限，主站 heap 默认 512 MB、cgroup 默认 1 GB，避免单个泄漏进程拖垮宿主机
- `deploy/nginx.conf` — Nginx 反向代理模板；保留线上 `steamx.cc www.steamx.cc`、Certbot include、上传接口大小限制，并为 Scratch GUI/vendor/chunk 加 gzip 和缓存；Release 会用 GitHub Variables 渲染域名/证书路径后同步到服务器，先备份当前站点配置、`nginx -t` 通过后再 reload
- `deploy/server-init.sh` — 服务器初始化脚本
- `deploy/auto-interactions-worker.mjs` — 自动互动队列 Docker worker（可在启动时按 `AUTO_INTERACTION_BACKFILL_*` 低比例补偿历史项目；随后按 `AUTO_INTERACTION_WORKER_INTERVAL_SECONDS` 周期 POST `/api/internal/auto-interactions/run`）
- `Dockerfile` — 生产镜像构建；基于 Node 22 构建并运行 Next standalone 与自动互动 worker 脚本
- `.github/workflows/ci.yml` — CI：Lint + TypeScript + Vitest + Build + Playwright；本地只在 `pre-commit` 跑 lint 和改动相关的用例，全量单测以此为唯一门槛，推送后用 `pnpm ci:watch` 看结论
- `.github/workflows/release.yml` — Release：构建 Docker 镜像 + 渲染/同步 Nginx 配置 + 同步 compose 文件 + SSH 部署；Nginx 默认写入 `/etc/nginx/sites-available/steam-app` 并维护 `/etc/nginx/sites-enabled/steam-app`，默认域名 `steamx.cc www.steamx.cc`；通用页面代理直接拒绝 GPTBot 请求但保留 `/robots.txt` 可访问，OAI-SearchBot 与其他爬虫继续按 robots 规则访问；站点参数可用 `NGINX_SERVER_NAME`、`NGINX_SSL_CERTIFICATE`、`NGINX_SSL_CERTIFICATE_KEY`、`NGINX_SITE_PATH`、`NGINX_SITE_ENABLED_PATH` 覆盖，若线上使用 `/etc/nginx/conf.d/*.conf` 可将两个 path 变量设为同一路径以跳过 `sites-enabled` symlink

---

## 11. 配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 依赖与脚本；主站依赖基线为 Next 16.2.x / React 19.2.x / Supabase JS 2.110.x / TypeScript 7.0.x / Tailwind CSS 4.3.x；Lint 策略已切到 Oxlint，不再保留 ESLint 链路 |
| `pnpm-lock.yaml` / `pnpm-workspace.yaml` | pnpm 包管理；锁文件保留 TypeScript 7 的平台可选包映射，确保 CI frozen install 能安装当前系统的 `tsc` 二进制 |
| `tsconfig.json` | TypeScript 配置（`@/` 路径别名） |
| `next.config.mjs` | Next.js 配置（图片域名、输出模式、`allowedDevOrigins`；`images.localPatterns` 允许 `/api/assets/**` 携带资源版本查询参数进入 `/_next/image`，其它本地图片仍限制查询串；内网/手机访问开发服务可用 `NEXT_ALLOWED_DEV_ORIGINS=ip1,ip2` 追加允许来源） |
| `app/globals.css` | Tailwind CSS 4 CSS-first 配置（`@import 'tailwindcss'`、`@plugin 'tailwindcss-animate'`、自定义 theme/utility）；中文正文/标题使用系统中文字体栈，WebFont 仅保留 JetBrains Mono 400/700，避免全站下载多组 Noto CJK 字重 |
| `postcss.config.js` | PostCSS 配置（Tailwind v4 使用 `@tailwindcss/postcss`） |
| `commitlint.config.js` | Git 提交信息规范 |
| `components.json` | shadcn/ui 组件配置 |
| `renovate.json` | Renovate 自动依赖更新 |
| `.codex/config.toml` | Codex 仓库级配置；使用 `freemodel` provider 的 Responses API，默认模型为 `gpt-5.6-luna`，推理强度为 `max` |
| `.env.example` | 环境变量模板；支持 `SUPABASE_FETCH_TIMEOUT_MS`（默认 12000ms）与 `ASSET_CONNECT_TIMEOUT_MS`（默认 10000ms）控制外部请求超时 |
| `.impeccable.md` | 设计上下文（用户画像、品牌调性、设计原则） |

### 常用 pnpm 脚本（`package.json`）

| 命令 | 说明 |
|------|------|
| `pnpm type-check` | TypeScript 类型检查（TypeScript 7 自带的 `tsc --noEmit`）；CI 使用此命令 |
| `pnpm lint` | Oxlint 快速检查产品源码（显式启用 React / Next.js 插件，覆盖 Hooks、Next、TypeScript 常用规则；检查 `app`/`components`/`hooks`/`lib`/Scratch 源码/根配置，跳过脚本与 agent 模板） |
| `pnpm test` / `pnpm test:e2e` / `pnpm test:e2e:integration` / `pnpm test:e2e:scratch` | Vitest 单元测试 / 主站 Playwright smoke / 真实 Supabase 集成测试 / 独立 Scratch host Playwright E2E |
| `pnpm test:related <files>` | 只跑 import 了指定文件的 Vitest 用例（`vitest related --run --passWithNoTests`）；`pre-commit` 就是跑 `lint` + 暂存文件的 related 测试（通常几秒）。不要在 `pre-commit` 用 `vitest --changed`：改动 `package.json` 等配置文件时它会退化成全量跑 |
| `pnpm push` / `pnpm ci:watch` / `pnpm ci:status` | 全量单测只在 CI 跑（没有 `pre-push` 钩子）。`pnpm push` = `git push` 后阻塞等 CI 结论，失败时列出失败 job/step 与运行链接；`ci:watch` 单独盯当前 HEAD（`--sha=`/`--timeout=` 可覆盖），`ci:status` 只看一眼当前状态。token 取自 `GITHUB_TOKEN`/`GH_TOKEN`（环境变量、`.env.local` 或 `gh auth token`），仓库私有所以必须有 token；没有 token 时脚本会打印申请指引，GitHub 也仍会在 workflow 失败时发邮件 |
| `pnpm eval:tutor` | 小迪 golden-set 真实模型评估（`TUTOR_GOLDEN_SET=1` 调 DashScope，普通 `pnpm test` 自动跳过）；提示词 / planner 规则改动先跑此评估再上线 |

> TypeScript 7 兼容说明：Next.js 16.2.10 仍硬编码检测 `typescript/lib/typescript.js`，而 TypeScript 7 不再提供该旧 API 文件。项目暂时保留 `@typescript/native-preview` 作为 Next 开发服务器的兼容标记，实际类型检查仍由 `typescript@7` 自带的 `tsc` 执行。待稳定版 Next.js 支持 `experimental.useTypeScriptCli`（或默认使用 TypeScript CLI）后，可删除该兼容依赖。

---

## 12. 静态资源 (`public/`)

| 目录 | 内容 |
|------|------|
| `public/assets/` | 页面背景图、英雄图（WebP/PNG）、游乐场插画；`/nature` 专题入口卡背景 `nature-topic-birds.webp` / `nature-topic-insects.webp` / `nature-topic-plants.webp` / `nature-topic-fungi.webp` |
| `public/assets/playground-art/function-wars/` | 函数战争 3 套生成式天空/远景 WebP 分层背景与新版炮台/普通敌方坦克/装甲敌方坦克/道具箱透明 WebP；渲染器支持天空/远景独立视差和主题环境动效；入口卡浅/深色 WebP 位于 `public/assets/playground-art/functionwars-transparent-*.webp` |
| `public/assets/profile-icons/` | 个人主页模块 icon WebP（256px、新手引导、探索地图、时间线、快捷入口 action-*） |
| `public/assets/species-detail/` | 物种详情信息卡插图（鸟类、植物、昆虫专题） |
| `public/avatars/` | 12 个默认头像 SVG |
| `public/xiaodi/` | 小迪原版动画 sprite：`sprite.webp`（7 状态 × 4 帧，供 `variant="default"` 预览/回退使用） |
| `public/xiaodi-ai/` | 小迪 AI 候选动画 sprite：`sprite.webp`（默认 `variant="ai-draft"` 使用，7 状态 × 8 帧）、全局关闭态轻量静帧 `idle.webp` 与观察详情头像静帧 `idle-0.webp` |
| `public/birds/` | 鸟类物种封面图与鸟鸣音频（已迁 OSS，本地目录 gitignore；配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后各环境先解析到同一资源域名，本地开发再经 `/api/assets` 模拟线上 Referer） |
| `public/insects/` | 昆虫物种封面图（已迁 OSS，本地目录 gitignore；静态图片重写策略同 `public/birds/`） |
| `public/trees/` | 树木物种封面图（已迁 OSS，本地目录 gitignore；静态图片重写策略同 `public/birds/`） |
| `public/fruits/` | 水果与干果物种图片（并入植物专题，已纳入 OSS 同步与 `/api/assets` 代理白名单；`images/` 本地目录 gitignore） |
| `public/projects/` | 项目封面图、步骤图（WebP）；`public/projects/*.webp` 根层旧封面、`public/projects/generated/*.webp` 与 `public/projects/steps/` 已迁 OSS，配置 `NEXT_PUBLIC_ASSETS_BASE_URL` 后各环境先解析到同一资源域名，本地开发再经 `/api/assets` 模拟线上 Referer |
| `public/logo.png` | 品牌 Logo（透明底圆形标，导航/登录等处使用） |
| `public/icon-192x192.png` / `public/icon-512x512.png` | PWA 图标（与品牌 Logo 同源）；`app/icon.png` / `app/apple-icon.png` 为站点 favicon / Apple Touch Icon |
| `public/gomoku-rapfi/` | 五子棋大师档 Rapfi 单线程 WASM（`rapfi-single.js/.wasm/.data`，GPL-3；`NOTICE.md` / `COPYING.txt`）；由 `lib/playground/gomoku-rapfi.ts` 以 Worker 加载 |
