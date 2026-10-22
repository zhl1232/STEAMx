# 语音协议、音色与验收

本文统一维护小迪语音接入、配置、音色、共享预算、缓存和取消语义。课程操作体验见 [手机搭建](../courses/mobile-building-experience.md)，代币边界见 [计费规则](tutor-credit-accounting.md)，避免在多个文档维护模型名与价格。

核对：2026-10-13，`0d322eda40dfdf81c7feb4f37703c9b38bea2b15`。本版本已包含 Audio 3.1 实现与其发布白名单配置；本次未连接供应商、试听或查询生产迁移。

## 接入和配置

- 默认 task 协议固定 TTS `qwen-audio-3.1-tts-flash`、ASR `qwen-audio-3.1-asr-flash-streaming`，适配器在 `lib/ai/tutor/speech-task.ts`，不由旧 auto-switch 候选静默选择旧型号。
- 复用 `DASHSCOPE_API_KEY`。配置 `DASHSCOPE_WORKSPACE_ID` 或 `DASHSCOPE_TUTOR_AUDIO_WS_URL=wss://<workspace>.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference`；缺省时按实现复用已有北京专属 API Host，并保留旧北京域名配置兼容。地址可构造不等于本账户新模型可达。
- 本接入只接受受校验的官方北京域名、WSS 和 inference 路径，拒绝未知域名、跨地域、URL 凭据及非标准端口；不把北京音色静默用于其他区域。
- 仅显式 `DASHSCOPE_TUTOR_AUDIO_PROTOCOL=legacy` 才回到旧协议和旧型号配置，同时关闭会员音色选择。新模式不自动回滚旧模型；429、取消或错误不能触发无界重试。

真实接入时核对当前业务空间专属域名、模型权限和额度。本文不再复制旧模型的人民币单价，也不以旧域名兼容测试认定新版服务已开通；成本需按实际模型、区域和供应商账单核对。

## 音色与缓存

当前白名单含默认叶知晴，以及会员可选的于小云、徐小俏、温怀清、安明远、龙安洋、龙三叔。`voice-access.ts` 重新读取 profiles 的有效会员资格，auth user_metadata 仅保存偏好，不作为权益证明；会员过期返回默认音色。

音色入口在“小迪 → 更多 → 朗读声音”，需以真实账号验证试听、保存、刷新及到期回退。描述和代码存在不等于本次试听通过。

完整音频只在当前 hook 内存保存，最多 8 项/16 MiB、10 分钟，单项不超过 8 MiB。重播前重查资格和音色；账号、音色、场景变化或已知到期时清理。不缓存取消/残缺音频，不写公共缓存或 localStorage。服务器不保存用户录音供重放。

## 任务和取消语义

任务握手完成才发送数据；TTS 以一致 UUID 运行、追加和结束，取消通知任务并关闭连接。ASR 等待最终结果，按句子 ID 去重和排序，不将中间识别或心跳当最终文本。连接、整体超时、提前关闭和空流均失败退出。

`transcribeTutorSpeechPcm16` 已接受 `signal?: AbortSignal`，普通转写端点传入 `request.signal`；task 与 legacy 路径都传递取消信号。客户端停止会丢弃迟到结果、释放对应会话，但不能保证撤销供应商已发生的费用。

当聊天正文仍在生成时，单独“停止朗读”不关闭整条聊天请求；已启动的聊天 TTS 可能继续到任务结束。整段清洗边界仍保留，不为逐 token 朗读放行推理、控制标记或工具 JSON。

音频边接收边播放；Web Audio 不可用时以同一份 PCM 生成 WAV，不二次合成。部分流错误、空流、取消不播放/缓存残片；完整流重复收尾不打断播放，原生播放失败释放对象 URL。页面内录音与朗读由共享音频会话互斥，但不控制其他标签页或设备。

## 共享预算与发布依赖

全应用共享预算由数据库 RPC 原子准入：TTS 每滚动 60 秒 180 次、ASR 600 次。它不覆盖其他应用对同一供应商账户的调用，也不代替端点的每用户限制。课程控制已改为端侧固定口令，不再消耗此 ASR 预算；资格续查只在 [手机搭建](../courses/mobile-building-experience.md) 维护。

所需迁移为 `20261013090000_tutor_speech_budget.sql`。该文件已进入本核对基线的 Release 白名单，详情见 [运行时迁移配置快照](../releases/2026-10-13/runtime-migrations.md)；不再写“白名单不包含”。缺少限流 RPC 时语音失败关闭，不能用移除预算检查来恢复服务。实际执行状态仍须核验。

数据库命令见 [数据库连接与迁移](../database-psql.md)，切换与恢复见 [生产部署](../deployment.md)。本文不另外提供绕过发布追踪的执行路径。

## 验收边界

mock、PGlite、协议构造、缓存和生命周期测试只能证明相应隔离行为。当前待核验：业务空间与新模型连通、真实额度/账单、默认及会员音色听感、儿童与家长短命令准确率、端到端延迟、桌面/手机播放和多实例预算。

分别验证自动朗读、停止、重播、录音开始结束、课内暂停/退出和会员过期回退；保留明确按钮操作，小迪问答不宣称已完成持续开放语音对话、离线识别或本地唤醒；课程端侧口令是独立有限协议。

## 课程端侧固定口令资源

本地课程监听实验改为 Vosk `vosk-model-small-cn-0.22` 和 `vosk-browser@0.0.8`。框架/封装的 Apache-2.0 由上游 COPYING、NOTICE 与 npm 包声明核实；这个中文模型的 Apache-2.0 依据为 [官方模型表](https://alphacephei.com/vosk/models)，包内 README 没有单独许可声明，不用框架许可推定模型许可。完整 notices、来源和限制在 [资源 NOTICE](../../public/courses/vosk/v1/NOTICE.md)，每个模型文件及运行包的摘要在 `model-source.json`。

运行资源位于同源 `public/courses/vosk/v1/`：压缩模型约 44.9 MB，含 WASM 的 JS 约 5.8 MB。课程关键资源完成后按网络策略静默准备，无外部 CDN、收费服务或音频上传；麦克风必须显式开启。准备器同时验证模型和运行包，在独立Worker完成下载/校验，再初始化模型和合成静音自检；固定资源表为 `assets.js`。上游 JavaScript loader 的小范围补丁增加压缩包校验与专用 CacheStorage，解压文件只在内存中；WASM 和权重字节没有修改。实际内存不等于下载体积，不能根据小模型名称承诺手机性能。

重建使用 `python3 scripts/prepare-building-vosk.py MODEL_ZIP VOSK_BROWSER_TGZ`，输入分别取官方模型 ZIP 与 npm `vosk-browser-0.0.8.tgz`，脚本先核对固定 SHA-256，再确定性打包并应用可审核的 loader 补丁。正常应用构建使用已附带资源，不自动下载模型或发布外部存储。应用语音行为、缓存失败提示与验收边界在 [手机搭建](../courses/mobile-building-experience.md) 维护。

原 sherpa-onnx v1.12.15 KWS / wenetspeech 3.3M INT8 的构建脚本、资源及 [NOTICE](../../public/courses/kws/v1/NOTICE.md) 保留作为先前实验；未采用许可未明确的 2025 大 ASR 模型，也未更改小迪开放问答的云语音接入。本地改动不构成推送、合并或部署授权。

## 协议参考

保留原实现文档的官方参考入口；本次文档整理未重新核验这些外部页面的最新内容：

- [TTS WebSocket](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-websocket-api)、[客户端事件](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-client-events)、[服务端事件](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-server-events)、[音色](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-voice-list)。
- [ASR 客户端](https://help.aliyun.com/zh/model-studio/qwen-audio-asr-streaming-client-events)、[ASR 服务端](https://help.aliyun.com/zh/model-studio/qwen-audio-asr-streaming-server-events)、[地域](https://help.aliyun.com/zh/model-studio/regions)、[北京接入](https://help.aliyun.com/zh/model-studio/beijing-access-information)。

先前 KWS 运行包（含 notices）约 16.2 MB，其中模型数据 5,025,604 字节、WASM 10,609,441 字节；测试 WAV 约 9.1 MB，不进入模型下载包。同模型 FP32 三份权重共 13,081,319 字节，INT8 共 5,023,977 字节；FP32 对照没有解决目标短口令漏检，当前保留小型 INT8，识别验收阻碍见课程专题及草稿 PR。
