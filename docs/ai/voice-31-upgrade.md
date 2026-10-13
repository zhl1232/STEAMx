# 语音 3.1 升级与验收

本轮先在独立分支实现和验证；后续已获得合入授权，按正常 PR 检查流程合入。合入会触发现有 Release 流程；不单独更改生产配置、密钥或执行生产 SQL。

## 接入与配置

- TTS 固定 `qwen-audio-3.1-tts-flash`，ASR 固定 `qwen-audio-3.1-asr-flash-streaming`。任务适配器独立于旧 auto-switch 候选，防止旧环境变量让实际请求仍选旧型号。文字与视觉选型不改。
- 复用 `DASHSCOPE_API_KEY`。推荐配置 `DASHSCOPE_WORKSPACE_ID`，或者 `DASHSCOPE_TUTOR_AUDIO_WS_URL=wss://<workspace>.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference`。未提供时优先复用已有北京 `DASHSCOPE_BASE_URL` / TTS / ASR URL 中的专属 API Host，并转换为 task 路径；没有专属域名时保留项目原有北京 `dashscope.aliyuncs.com` 默认入口，仍使用新模型。只读检查的跟踪配置没有真实 Workspace ID；没有读取生产凭据。
- 官方将旧域名列为存量业务兼容，并注明自 2026-09-30 起不再支持新特性；本实现保留旧北京配置，不代表已实测本账户的新版模型可达。上线验收建议确认北京业务空间专属 API Host、模型权限与额度。配置只接受官方北京域名，拒绝未知域名、跨地域、凭据嵌入及非标准端口。
- 本轮音色菜单只适用于北京。专属地址要求 WSS、北京域名和 `/inference` 路径；新加坡不静默使用北京音色。
- 默认叶知晴；会员可选于小云、徐小俏、温怀清、安明远、龙安洋、龙三叔。描述依据官方文字，尚未试听。会员资格从 profiles 重新核验，用户元数据仅保存白名单内的偏好。过期返回默认女声。
- 部署前需通过项目规定的 `pnpm db:push` 流程应用 `20261013090000_tutor_speech_budget.sql`；本轮未执行。缺少限流 RPC 时语音失败关闭，文字仍应可用。该预算覆盖本应用实例，不涵盖其他应用共享同一供应商账户的调用。
- 显式设置 `DASHSCOPE_TUTOR_AUDIO_PROTOCOL=legacy` 可回滚原 TTS/ASR 协议，会员选择关闭。旧型号/voice 只在该模式使用，3.1 音色不会发给旧接口；旧北京 URL 的域名可用于新 task 协议。新模型默认不自动滚回旧模型；429/取消不自动重试。

## 体验与边界

- 保留原有录音、课程短命令、音频互斥会话与清洗边界。ASR 只合并最终句子，忽略中间结果/心跳，按 sentence_id 去重并排序。
- 任务握手后才发送数据，TTS 使用一致 UUID 的 run/continue/finish，取消发送 cancel 指令并关闭连接；ASR 结束后等待最终完成。错误、提前关闭、连接超时与整体超时均失败退出。
- 回复仍须整段清洗，未提前放行推理内容、控制标记或工具 JSON。不宣称实现逐 token 边生成边朗读。
- 音频边接收边播放；Web Audio 不可用时将同一批 PCM 转成 WAV，避免二次付费合成。朗读中断保留文字并提示用户手动重试，不再次串行调用多个供应商接口。
- 原生 WAV 回退在部分流失败、空流、取消时立即释放播放状态和会话，不播放或缓存残缺音频；完整流重复收尾不打断播放，原生播放失败会释放对象 URL。回归测试先复现部分流故障，再验证修复。
- 完整音频只保存在当前 hook 内存，最多 8 项/16 MiB、10 分钟；单项不超过 8 MiB。重播前再查服务端会员和音色状态。用户、音色、场景变化或已知会员到期清理；取消/不完整流不缓存，不写公共缓存或 localStorage。
- 客户端停止会即时停止并丢弃迟到音频；独立朗读/转写请求取消传入服务端。聊天正文继续生成时，单独停止播放不会关闭整条聊天请求，因此已启动的聊天 TTS 可能继续到任务结束。
- 服务器不缓存用户语音；全站共享限额由数据库原子检查，不仅依赖端点的每用户限额。应用没有真实音频、供应商额度或多实例生产验证。

## 官方协议依据

- https://help.aliyun.com/zh/model-studio/qwen-audio-tts-websocket-api
- https://help.aliyun.com/zh/model-studio/qwen-audio-tts-client-events
- https://help.aliyun.com/zh/model-studio/qwen-audio-tts-server-events
- https://help.aliyun.com/zh/model-studio/qwen-audio-tts-voice-list
- https://help.aliyun.com/zh/model-studio/qwen-audio-asr-streaming-client-events
- https://help.aliyun.com/zh/model-studio/qwen-audio-asr-streaming-server-events
- https://help.aliyun.com/zh/model-studio/regions
- https://help.aliyun.com/zh/model-studio/beijing-access-information

## 验证

协议、权限、音色保存、缓存和生命周期使用本地 mock 测试；未调用付费模型或真实支付。需后续在授权环境确认接入域名、新模型可达性、真实额度、默认音色听感、儿童短命令准确率和桌面/手机真实设备播放。旧北京地址兼容测试只验证构造与新协议负载，不是生产连通验收。

2026-10-13 本地结果：

- `pnpm run type-check`：通过。
- `pnpm run lint`：通过（仍有 React 提示，不是零警告）。
- `pnpm exec vitest run lib/ai/tutor components/features/tutor lib/ai/dashscope.test.ts app/api/tutor/speech components/features/courses/building-voice-capture.test.ts components/features/courses/building-voice-controls.test.tsx components/features/courses/use-building-voice-controls.test.tsx lib/courses/building-voice-commands.test.ts`：63 个文件、628 项通过（含原生回退修复与北京域名兼容回归）。
- `node scripts/test-tutor-speech-budget.mjs`：通过；`PGLITE_MODULE_PATH` 指向任务目录临时安装的 PGlite，项目未新增依赖。验证真实迁移、角色权限、两个滚动配额及过期；不代表多连接生产压测。
- `git diff --check`：通过。工作流文件未修改，未调用 workflow dispatch。

分支基于同步确认的 `c21a18639fd04a5fbb35d0fa696c7dafb99ac725`。首阶段推送后远端 main 推进到 `a1ce88ad5f3776c6d1192587431a671d611472cc`；只读比较没有语音实现重叠，PR 合入需保留这些其它改动。

验收入口：小迪 → 更多 → 朗读声音。会员可试听并保存，刷新后检查选择；非会员及会员过期应使用默认叶知晴。另测聊天自动朗读、停止/重复播放、手机录音开始结束，以及搭建课程的下一步/暂停等短命令。共享配额迁移未应用时语音会失败关闭；现有 Release 的迁移白名单不包含本迁移，合入不等于生产语音已就绪。
