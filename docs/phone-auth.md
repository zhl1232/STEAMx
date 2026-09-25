# 手机注册与登录配置

项目使用阿里云托管 Supabase。登录界面与账号设置共用 `/api/auth/sms/send`、`/api/auth/sms/verify`。

## 手机认证

`AUTH_PHONE_PROVIDER` 是服务端运行时变量：未设置时保留 `legacy` 自建短信流程；设为 `supabase` 后，验证码的发送、验证、有效期和会话由 Supabase Phone 管理。原生模式失败不会回退到自建验证码。

切换步骤：

1. 在 Supabase Authentication → Providers → Phone 配置实际短信服务、AK/SK、签名和模板，并启用 Phone。使用与账号已开通的服务对应的提供商；现有自建实现使用的是阿里云号码认证 Dypnsapi，不能直接假定与普通 Dysms 的模板兼容。
2. 保持短信验证启用（`sms_autoconfirm=false`），验证码长度为 6、重发间隔为 60 秒，配置合理的有效期（建议 300 秒）。检查 Auth 限流与短信余额。
3. 核对 `phone_to_user.phone` 与对应 `auth.users.phone` 的数字部分相同，避免新建重复账号。2026-09-20 只读核验当前实例：4 条映射，无缺失用户，无手机号不一致；此结果不替代切换时重新核验。
4. 在应用服务端配置 `AUTH_PHONE_PROVIDER=supabase` 并重启/发布应用。用已有手机号验证登录、原有资料/作品、退出重登；用测试新手机号验证注册和课程落地；验证账号安全页首次绑定与找回密码。

原生流程沿用现有用户 ID，注册资料由数据库 `handle_new_user` 触发器创建，验证后维护 `phone_to_user` 兼容映射。不要删除旧表或重新导入用户。首次绑定使用 `updateUser({phone})` 和 `verifyOtp({type:'phone_change'})`。

## 当前配置状态与待办

2026-09-20 更新：用户已保存短信配置，核验 Phone 已启用、提供商为 `aliyun`，短信 AK、签名、模板均已填写且要求手机号验证。纠正了填反的验证码长度与有效期，现为 6 位、300 秒，重发间隔 60 秒。本地 `.env.local` 已切换 `AUTH_PHONE_PROVIDER=supabase`；发布代码不会自动切换生产短信提供商，生产须另行设置该变量。真实短信收取及完整登录仍待用户实测。微信登录暂不接入。

参考：[阿里云认证配置](https://help.aliyun.com/zh/rds/apsaradb-rds-for-postgresql/authentication)、[Supabase 手机登录](https://supabase.com/docs/guides/auth/phone-login)。

### 短信发送超时排查（2026-09-20）

经用户指定号码进行一次发送测试：应用接口约 10.4 秒返回 Supabase `Processing this request timed out`，与 Auth 的 `api_max_request_duration=10` 一致；同实例健康检查与管理用户查询约 0.4 秒返回 200。尚不能据此判断是短信提供商网络、权限还是服务端实现问题。检查发现 `sms_template` 使用了阿里云 `${code}` 占位符，已替换为 Supabase 的 `{{ .Code }}`，正文其余内容保持不变；修正后的真实发送仍需验证。下一步对照阿里云短信控制台发送记录/错误码，用同一签名模板在控制台测试发送，以区分短信账号配置与 Supabase 集成故障。不要仅通过延长超时掩盖原因。

用户反馈：阿里云 OpenAPI 调试返回 OK，但手机未收到；签名存在运营商报备未完成提示。平台受理、运营商送达及 Supabase 请求超时是不同环节，不能以报备未完成作为原生接口超时的已确认原因。原生认证保持服务端显式开关，生产在真实发送/注册/老账号登录验收前继续使用现有配置。


### 2026-09-21 发送超时复核

用户确认 15:36（北京时间）点击发送验证码后超时、手机未收码，阿里云控制台未发现对应发送记录。生产已通过运维任务启用 `AUTH_PHONE_PROVIDER=supabase`；任务成功不代表短信验收成功。

只读复核：Auth 健康接口和管理用户查询均约 0.4 秒返回 200；Phone 开启、`sms_provider=aliyun`、自动确认关闭、6 位验证码、300 秒有效期、60 秒重发间隔、Auth 请求上限仍为 10 秒；短信 Hook 未启用，模板包含 `{{ .Code }}`。前端发送接口调用 `signInWithOtp` 并透传上游超时，验证码验证路径尚未执行。

尚未定位具体根因。需要托管实例在 2026-09-21 07:36 UTC 附近的 Auth `/otp` 日志（含 request_id、下游请求耗时、错误码），确认到短信服务端点的 DNS/TLS/网络、AK 权限、地域及实际签名模板对应的产品。控制台无记录只能说明未找到受理记录，不能单凭这一点判断一定是网络或运营商问题。不要以延长超时、自动确认手机或静默回退替代修复。此轮未发送新的短信、未修改上游 Auth 配置。


## Supabase Send SMS Hook（备用方案，待 EIP 复测结果决定是否启用）

背景：托管 Supabase 实例内置阿里云短信调用在 `signInWithOtp` 时挂满 10 秒返回 504，疑似实例无法访问公网短信 API；本应用服务器访问正常。若为 Supabase 绑定 EIP 后内置短信仍不可用，则启用 Send SMS Hook：Supabase 只负责生成/校验验证码与会话，短信由本应用 `/api/auth/sms/hook` 通过既有阿里云号码认证（Dypnsapi `SendSmsVerifyCode`，签名 `速通互联验证码`、模板 `100001`，与 legacy 相同）发送。

实现：`app/api/auth/sms/hook/route.ts` → `lib/auth/send-sms-hook.ts`。

- 验签：Standard Webhooks（`standardwebhooks` 包），secret 取 `SUPABASE_SEND_SMS_HOOK_SECRET`，接受 `v1,whsec_<base64>` 原样值；`|` 分隔可同时配置新旧 secret。签名失败 401，时间戳超 5 分钟视为重放拒绝。签名是唯一的安全边界，接口不校验 host、不需要 cookie/登录，`proxy.ts` matcher 已排除该路径。
- 号码：优先 `sms.phone`（新版 Auth 提供，换绑时为新号码），否则 `user.phone`；必须是 `86` 开头的大陆手机号，规范为 11 位后发送。
- 响应：成功 200 `{}`；payload 不合法 400；未配置 secret 500；阿里云返回非 OK/抛错 502；阿里云超时 504。均为 `{ "error": { "http_code", "message" } }` 且 `Content-Type: application/json`。不返回 429/503，避免 Supabase 重试导致重复发短信。
- 超时：Supabase HTTP hook 整体 5 秒（含重试）。阿里云调用 `SUPABASE_SEND_SMS_HOOK_SMS_TIMEOUT_MS`，默认 3000，限制在 500–3500，SDK 连接/读取超时 + 外层硬截止，整体约 4 秒内返回。
- 日志：失败一行 `[auth/sms/hook] aliyun send failed ... phone=138****8000 code=... requestId=...`，成功一行 `[auth/sms/hook] sent ...`；不记录验证码、完整手机号与 secret。`/api/auth/sms/send` 在 Supabase 返回错误或抛错时记录 `[auth/sms/send] supabase signInWithOtp failed provider=supabase phone=... status=... code=... elapsedMs=... message=...`，接口行为不变。

上线清单（生产操作须另行授权）：

1. 发布包含本接口的版本。确认生产 `.env.production` 已有 `SMS_ALIYUN_ACCESS_KEY_ID`、`SMS_ALIYUN_ACCESS_KEY_SECRET`，`AUTH_PHONE_PROVIDER=supabase` 保持不变。
2. Supabase 控制台 Authentication → Hooks → Send SMS hook：类型选 HTTP(S)，URL 填 `https://steam.bj.cn/api/auth/sms/hook`，生成 secret。托管 Auth 只接受 https（http 仅限 localhost），不使用内网 http 地址。阿里云托管版控制台入口/字段名可能不同，需核对：是否支持 HTTP 类型 hook、secret 是否为 `v1,whsec_` 格式、hook 超时是否为 5 秒。
3. 把 secret 原样写入生产 `SUPABASE_SEND_SMS_HOOK_SECRET`（可选 `SUPABASE_SEND_SMS_HOOK_SMS_TIMEOUT_MS=3000`），重启 steam-app，再在控制台启用 hook。先配 env 再启用，否则 hook 返回 500 会导致发码失败。
4. nginx 与安全组无需改动：公网 443 已反代到 Next.js，该路径无跳转。
5. 验证：用测试号点击「获取验证码」，应在数秒内返回 200 并收到短信；容器日志出现 `[auth/sms/hook] sent`；再完成验证码登录。失败时按日志中 `code`/`requestId` 对照阿里云控制台。
6. 回退：在 Supabase 控制台关闭 Send SMS hook 即恢复内置短信（或按既有流程切回 legacy），无需改代码。
