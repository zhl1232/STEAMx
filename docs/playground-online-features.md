# 游乐场联网功能说明

更新时间：2026-07-15

## 判断口径

这次把「可以加联网功能」限定为当前代码里能公平比较或能安全实时同步的模式：

- 双人规则天然成立的游戏，做实时房间对战。
- 固定关卡或固定参数的单人游戏，做 6 位邀请码竞速房间。
- 已有云端公开成绩口径的游戏，保留/说明榜单联网能力。
- 随机题面、随机棋盘或开放沙盒如果没有共享种子/题面同步，暂不硬接竞速，避免双方玩的不是同一题。

## 已接入的联网能力

| 游戏 | 联网方式 | 当前规则 |
|---|---|---|
| 五子棋 | 实时双人对弈 | 房间码加入，落子由 `gomoku_place_stone` RPC 权威判定 |
| 记忆翻牌 | 实时双人对战 | 房主选主题/难度，翻牌由 `memory_flip_card` RPC 权威判定 |
| 扫雷 | 云端排行榜 | 按难度读取全服前十最佳用时 |
| 24 点 | 竞速房间 | 创建房间时固定同一组牌，用时少者胜，超时/跳过不计胜 |
| 速算闪电战 | 竞速房间 | 60 秒比得分，得分相同比最长连击 |
| 汉诺塔 | 竞速房间 | 同盘数通关，步数少者胜，步数相同比用时 |
| N 皇后 | 竞速房间 | 同棋盘规模手动解题，用时少者胜 |
| 数字华容道 | 竞速房间 | 创建房间时固定同一初始棋盘，步数少者胜，步数相同比用时 |
| 数织 | 竞速房间 | 同一固定关卡通关，用时少者胜 |
| 球排序 | 竞速房间 | 同一固定关卡通关，步数少者胜，步数相同比用时 |
| 天平称重 | 竞速房间 | 同一固定关卡找出假币，称量次数少者胜，次数相同比用时 |
| 像素对称 | 竞速房间 | 同一固定关卡通关，星级高者胜，再比误点、步数、用时 |
| 七巧板 | 竞速房间 | 同一固定关卡完成拼图，用时少者胜 |

竞速房间支持：

- 登录后创建房间，生成 6 位邀请码。
- 复制邀请链接，链接带 `?room=` 参数。
- 另一名玩家输入邀请码或打开邀请链接加入。
- 房间设置固定在创建时，例如关卡 id、盘数、棋盘规模。
- 随机题面类游戏先把题面写入房间设置，例如 24 点牌面、数字华容道初始棋盘。
- 加入后页面自动切换到房间指定设置。
- 玩家完成本局时自动提交成绩。
- 双方成绩到齐后服务端计算胜负。
- 等待房间截止时间为 15 分钟，进行中房间为 30 分钟；到期后由活跃页下一次 4 秒权威读取或后续创建/加入请求触发结算。只有一方提交则该方获胜，双方都未提交则取消且不计胜负。
- 成绩写入由 `submit_playground_race_result` RPC 原子检查数据库截止时间，过期结算由 `expire_playground_race_matches` RPC 完成，浏览器计时不决定胜负。
- 当前没有 heartbeat，因此超时只表示玩家未在截止前提交，不能据此判断具体玩家是否断线。
- Realtime 可用时订阅房间变化，同时始终保留 4 秒权威 API 轮询，推进截止结算并作为断线兜底。
- 并发加入使用 `status = waiting AND guest_user_id IS NULL` 条件更新；只有一个访客成功，失败请求返回 `409`，并记录不含用户和邀请码的结构化冲突指标。

## 稳定性验证

- `e2e/integration/playground-online.spec.ts` 使用三个真实登录上下文验证 24 点 UI 建房、邀请链接自动加入、双方提交与胜负渲染、并发加入只有一个成功、等待房间过期、单方提交超时判胜和双方未提交超时取消，并在结束后清理临时对局和用户。
- `__tests__/api.playground-race-rooms-route.test.ts` 验证加入竞争的两种交错顺序、同一访客重复请求幂等，以及权威读取触发等待房间结算。
- `e2e/smoke.spec.ts` 验证未登录打开带 `?room=` 的邀请页时，登录链接的 `next` 参数会完整保留房间码。
- 集成套件依赖真实 Supabase 环境，通过 `pnpm test:e2e:integration` 单独运行；普通 CI smoke 不依赖 service role。

## 本次新增/修改的主要文件

数据库：

- `supabase/migrations/20260715113000_playground_race_game_keys.sql`
- `supabase/migrations/20260714190300_playground_race_matches.sql`
- `supabase/migrations/20260714190400_playground_race_realtime_publication.sql`
- `supabase/migrations/20260714190500_playground_race_realtime_channel_policy.sql`
- `supabase/migrations/20260715164600_playground_race_lifecycle.sql`
- `lib/supabase/types.ts`

服务端 API：

- `app/api/playground/race-rooms/route.ts`
- `app/api/playground/race-rooms/join/route.ts`
- `app/api/playground/race-rooms/[id]/route.ts`
- `app/api/playground/race-rooms/[id]/result/route.ts`
- `app/api/playground/race-rooms/[id]/leave/route.ts`

共享逻辑与客户端：

- `lib/playground/race-online.ts`
- `hooks/playground/use-race-online.ts`
- `components/features/playground/race-online-panel.tsx`
- `hooks/playground/use-game-room.ts`

接入页面：

- `app/playground/24game/page.tsx`
- `app/playground/quickmath/page.tsx`
- `app/playground/hanoi/page.tsx`
- `app/playground/nqueens/page.tsx`
- `app/playground/fifteen/page.tsx`
- `app/playground/nonogram/page.tsx`
- `app/playground/ballsort/page.tsx`
- `app/playground/balance/page.tsx`
- `app/playground/symmetry/page.tsx`
- `app/playground/tangram/page.tsx`

同时保留此前已接入的：

- `app/playground/gomoku/page.tsx` 相关在线五子棋能力。
- `app/playground/memory/page.tsx` 相关在线记忆翻牌能力。
- `app/playground/minesweeper/page.tsx` 相关云端排行榜能力。

## 暂不直接接入竞速的游戏

| 游戏 | 原因 | 后续接入条件 |
|---|---|---|
| 2048 | 随机新方块会影响局面，直接比不同随机局不公平 | 房间保存共享随机种子或服务端发牌序列 |
| 数独 | 当前题面随机生成，难度相同也可能题面差异大 | 房间保存完整 puzzle/solution 或题库 id |
| 迷宫探险 | 迷宫生成带随机候选，路线复杂度不同 | 房间保存迷宫地图或生成种子 |
| 生命游戏 | 更像规则沙盒/挑战模拟，不是天然对战或竞速 | 需要单独设计协作沙盒、共享初始图或挑战题 |

这些不是不能联网，而是不能在当前没有共享题面的情况下公平接入竞速。异常生命周期已补齐；下一步做「房间持有共享 seed/题面」，再评估把 2048、数独、迷宫接入同一个竞速框架。
