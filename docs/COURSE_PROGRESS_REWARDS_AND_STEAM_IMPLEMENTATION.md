# 积木课程进度、作品奖励与 STEAM 结算

> 状态：当前实现与维护 runbook。课程闭环迁移已执行，最后复核：2026-09-09。

本文记录线上正在使用的课程进度、作品奖励和 STEAM 雷达口径。后续改动应先核对本文件、迁移和对应测试。

## 当前行为

- 课时完成写入 `user_lesson_progress`，不发 XP，也不再新增 `complete_lesson` 奖励流水；历史流水保留，不追扣、不冲正。
- 完成 API 在服务端校验登录、课程/课时关系、限流和 Scratch 必要校验后调用 service-role-only `record_course_lesson_completion`。重复请求幂等。
- 课程作品提交不发 XP；审核通过的终稿由原子奖励路径一次发放 `+20 XP`。重复审核、并发审核和删除重建不会重复记账。
- 非空课程的当前课时全部以可信来源完成后，最多生成一条 `user_course_completions`。快照保存课时数、STEAM 权重和难度。
- STEAM 雷达只统计 approved final 项目、挑战完成、课程里程碑和 approved 且 `moderation_state='approved'` 的自然观察；自然观察固定按 3 星、`S:15` 计入科学维度。课程作品不额外作为项目贡献，雷达结果按稳定顺序计算。
- 登录用户获得批量计算的课程进度、下一课时和里程碑时间；匿名响应的 `progress` 为 null。`legacy_client` 完成记录可显示为历史已完成，但不会未经验证写入里程碑。

## 数据与权限基线

迁移 `supabase/migrations/20260731100000_course_progress_rewards_and_steam.sql` 创建/维护 `user_course_completions`、完成与 reconcile RPC、课程配置约束和雷达函数；后续奖励与雷达口径修订见同目录后续迁移。`lib/supabase/types.ts` 与迁移同步。

里程碑只允许本人读取（审核角色可读排障），普通客户端不能写入。完成、reconcile 和奖励结算均由服务端受控入口调用，RPC 固定 search path 并限制为 service role；不要把用户 ID 作为客户端可控参数转发。

课程配置必须有 S/T/E/A/M 五项有限非负权重且至少一项大于 0，难度为 1–6。非法配置修复前，完成仍保存进度并返回 `courseCompletionState='configuration_error'`，之后再由 reconcile 补结算。

## 维护入口

数据库命令会通过 `scripts/db-push.mjs` 确保 `public._schema_migrations` 追踪表存在；即使 `db:status` 或 `--dry-run` 也可能创建该表。具体连接、迁移和权限边界遵循 [`database-psql.md`](./database-psql.md) 与 `.cursor/rules/db-migrations.mdc`，不要把这些命令当作无副作用的本地检查。

每次课程结构、配置、审核奖励或雷达逻辑发布后运行：

```bash
pnpm db:status
pnpm db:course-config
pnpm course:audit
pnpm course:audit -- --json
```

`course:audit` 使用 pg-meta 查询做只读审计；默认阻断 P1 错误，`--strict` 会把历史 P2 advisory 也视为失败。当前已知的 3 条历史孤立 `complete_project` XP 流水保留，不删除、冲正或重发。

课程配置修复后先运行 `pnpm db:course-config`，再按单课程调用 service-role `reconcile_course_completions`。它只接受 approved 课程和可信完成来源，不会把 legacy 记录自动升级为能力来源，也不发 XP。

发现“已批准但无奖励流水”时，先用 `repair_completion_rewards(p_apply => false)` dry-run，确认范围后才 apply。记录审计输出，不记录 Scratch 文件内容。

## 关键接口契约

完成接口保留 `progress`、`alreadyCompleted`，并返回 `courseProgress` 与 `courseCompletionState`；状态固定为 `not_complete | created | already_recorded | configuration_error`。

`lib/api/courses.ts` 按批次读取课程、课时和当前用户进度，禁止逐课程 N+1；个性化响应使用 `private, no-store`。`lib/courses/progress.ts` 负责空课程、部分完成、全部完成和稳定下一课时的纯计算。

## 测试与发布检查

重点测试：`__tests__/api.courses-lesson-complete-route.test.ts`、`__tests__/api.completion-review-route.test.ts`、`lib/api/courses.test.ts`、课程进度纯函数测试和 `scripts/course-closure-audit.test.ts`。发布前确认：

- 首次/重复课时完成不产生 XP，Scratch 校验和匿名/登录进度隔离通过。
- 并发完成最后课时只生成一条里程碑；非法配置不回滚进度，修复后可补结算。
- pending 提交不奖励，审核通过精确增加 20 XP，重复/并发审核幂等。
- pending、rejected 和非 final 项目不进雷达，雷达重复计算 JSON 稳定。
- 普通 authenticated 不能直写里程碑；完成来源由 RPC 维护，legacy completion 不会自动固化为能力。

线上用 `pnpm course:audit -- --json` 采集配置错误、奖励 no-op/重复、里程碑缺口和 reconcile 延迟。回滚时切回应用读取或暂时移除雷达新来源，不删除里程碑、进度或历史 XP，也不恢复课时 XP。

## 课程目录的展示与入口

实现入口：`app/courses/page.tsx` → `components/features/courses/course-board.tsx` → `course-hub.tsx`。分类与路由纯函数在同目录 `course-catalog.ts`，样式限定在 `course-hub.module.css`。

- 页面仍由服务端原有 `listApprovedCourses` 批量读取课程与当前用户进度。客户端只筛选传入目录，不新增数据请求、缓存个人进度或写完成状态。
- 推荐页前置一个真实在学入口，并从下方推荐区移除同一课程。多个在学课程通过「在学课程」查看；暂未提供最近访问时间，不声称首项为最近学习。
- 「继续学习」使用服务端提供的 `next_lesson_id`，无下一课时则进入课程目录；已完成课程显示「回顾课程」，零课时课程仅显示「查看课程」。课程标题始终链接课程目录。
- 推荐沿用接口顺序、优先积木。分类根据已有名称/标签，只有有内容的分类才出现；Scratch 编程优先于实体积木识别，未识别类别进入「其他技能」，不能漏掉课程。
- 卡片只展示真实课时、进度及公开分级。未登录/未开始不虚构进度；没有分级则不编造年龄或陪伴要求；封面缺失/失败显示占位，换图后可恢复。
- 横幅 `public/assets/courses-hero-art.webp` 是经用户审阅的设计图中的装饰插画裁切，不是课程成果或课程封面；横幅标题为真实文本，不是整张效果图贴上页面。
- 手机采用单列紧凑横向课程卡，继续学习按钮和进度位于右侧信息区；平板/桌面自适应双列或三列。入门专题链接收于原生折叠，保留真实 URL 和无需 JavaScript 的展开。

对应回归：`components/features/courses/course-board.test.tsx`，检查真实链接、分类/全部/在学切换、推荐去重、匿名/完成/空目录/请求失败、封面错误恢复。修改目录展示不应执行数据库命令或触发生产部署。
