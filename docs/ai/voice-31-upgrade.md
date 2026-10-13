# 语音 3.1 分支交付

本轮仅独立分支交付，不合入 main、不部署、不创建 PR 或触发工作流。

## 接入与配置

- TTS 固定 `qwen-audio-3.1-tts-flash`，ASR 固定 `qwen-audio-3.1-asr-flash-streaming`。任务适配器独立于旧 auto-switch 候选，防止旧环境变量让实际请求仍选旧型号。文字与视觉选型不改。
- 复用 `DASHSCOPE_API_KEY`。需要非敏感配置 `DASHSCOPE_WORKSPACE_ID`，或者 `DASHSCOPE_TUTOR_AUDIO_WS_URL=wss://<workspace>.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference`。只读检查的跟踪配置没有真实 Workspace ID；没有读取生产凭据。
- 本轮音色菜单只适用于北京。专属地址要求 WSS、北京域名和 `/inference` 路径；新加坡不静默使用北京音色。
- 默认叶知晴；会员可选于小云、徐小俏、温怀清、安明远、龙安洋、龙三叔。描述依据官方文字，尚未试听。会员资格从 profiles 重新核验，用户元数据仅保存白名单内的偏好。过期返回默认女声。
- 部署前需通过项目规定的 `pnpm db:push` 流程应用 `20261013090000_tutor_speech_budget.sql`；本轮未执行。缺少限流 RPC 时语音失败关闭，文字仍应可用。该预算覆盖本应用实例，不涵盖其他应用共享同一供应商账户的调用。
- 显式设置 `DASHSCOPE_TUTOR_AUDIO_PROTOCOL=legacy` 可回滚原 TTS/ASR 协议，会员选择关闭。旧 `DASHSCOPE_TUTOR_*` 型号/URL/voice 只在该模式使用，3.1 音色不会发给旧接口。新模型默认不自动滚回旧模型；429/取消不自动重试。

## 体验与边界

- 保留原有录音、课程短命令、音频互斥会话与清洗边界。ASR 只合并最终句子，忽略中间结果/心跳，按 sentence_id 去重并排序。
- 任务握手后才发送数据，TTS 使用一致 UUID 的 run/continue/finish，取消发送 cancel 指令并关闭连接；ASR 结束后等待最终完成。错误、提前关闭、连接超时与整体超时均失败退出。
- 回复仍须整段清洗，未提前放行推理内容、控制标记或工具 JSON。不宣称实现逐 token 边生成边朗读。
- 音频边接收边播放；Web Audio 不可用时将同一批 PCM 转成 WAV，避免二次付费合成。朗读中断保留文字并提示用户手动重试，不再次串行调用多个供应商接口。
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

## 验证

协议、权限、音色保存、缓存和生命周期使用本地 mock 测试；未调用付费模型或真实支付。需后续在授权环境确认 Workspace、真实额度、默认音色听感、儿童短命令准确率和桌面/手机真实设备播放。
