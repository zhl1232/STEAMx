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
| 速算闪电战 | 竞速房间 | 60 秒比得分，得分相同比最长连击 |
| 汉诺塔 | 竞速房间 | 同盘数通关，步数少者胜，步数相同比用时 |
| N 皇后 | 竞速房间 | 同棋盘规模手动解题，用时少者胜 |
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
- 加入后页面自动切换到房间指定设置。
- 玩家完成本局时自动提交成绩。
- 双方成绩到齐后服务端计算胜负。
- Realtime 可用时订阅房间变化，不可用时走 `use-game-room` 的 4 秒轮询兜底。

## 本次新增/修改的主要文件

数据库：

- `supabase/migrations/20260714190300_playground_race_matches.sql`
- `supabase/migrations/20260714190400_playground_race_realtime_publication.sql`
- `supabase/migrations/20260714190500_playground_race_realtime_channel_policy.sql`
- `lib/supabase/types.ts`

服务端 API：

- `app/api/playground/race-rooms/route.ts`
- `app/api/playground/race-rooms/join/route.ts`
- `app/api/playground/race-rooms/[id]/result/route.ts`
- `app/api/playground/race-rooms/[id]/leave/route.ts`

共享逻辑与客户端：

- `lib/playground/race-online.ts`
- `hooks/playground/use-race-online.ts`
- `components/features/playground/race-online-panel.tsx`
- `hooks/playground/use-game-room.ts`

接入页面：

- `app/playground/quickmath/page.tsx`
- `app/playground/hanoi/page.tsx`
- `app/playground/nqueens/page.tsx`
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
| 24 点 | 每轮随机 4 张牌不同，直接比速度不公平 | 房间保存同一组牌/题库序列 |
| 数字华容道 | 初始打乱随机，直接比不同盘面不公平 | 房间保存初始棋盘 |
| 数独 | 当前题面随机生成，难度相同也可能题面差异大 | 房间保存完整 puzzle/solution 或题库 id |
| 迷宫探险 | 迷宫生成带随机候选，路线复杂度不同 | 房间保存迷宫地图或生成种子 |
| 生命游戏 | 更像规则沙盒/挑战模拟，不是天然对战或竞速 | 需要单独设计协作沙盒、共享初始图或挑战题 |

这些不是不能联网，而是不能在当前没有共享题面的情况下公平接入竞速。下一步如果要继续扩展，优先做「房间持有共享 seed/题面」后再把 2048、24 点、数字华容道、数独、迷宫接进同一个竞速框架。
