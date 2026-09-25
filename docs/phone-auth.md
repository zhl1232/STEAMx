# 手机注册与登录配置

项目使用阿里云托管 Supabase。登录界面与账号设置共用 `/api/auth/sms/send`、`/api/auth/sms/verify`。

## 手机认证

`AUTH_PHONE_PROVIDER` 是服务端运行时变量：未设置时保留 `legacy` 自建短信流程；设为 `supabase` 后，验证码的发送、验证、有效期和会话由 Supabase Phone 管理。原生模式失败不会回退到自建验证码。

切换步骤：

1. 在 Supabase Authentication → Providers → Phone 配置实际短信服务、AK/SK、签名和模板，并启用 Phone。使用与账号已开通的服务对应的提供商；2026-09-25 起 legacy 实现使用普通短信 Dysmsapi SendSms；更早的号码认证 Dypnsapi 配置不可直接混用。
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

### 2026-09-25：切回应用发送短信（待发布与实测）

用户选择保留 legacy 认证流程，由网站服务器调用普通短信 `SendSms`，签名「北京创探科技」、模板 `SMS_332130837`，正文 `您的验证码为：${code}，请勿泄露于他人！`，只传数字变量 `code`。应用校验并消费 `phone_otps` 中的验证码，不再调用 Dypns 验证。Supabase 仍保存用户和建立会话；短信发送不再依赖其公网出口。

运行配置位于**服务器** `/opt/steam-app/.env.production`。本地 `.env.production` 不会被 Release 自动上传，短信密钥也没有从 GitHub Secrets 自动同步的流程。配置新的 `SMS_ALIYUN_ACCESS_KEY_ID` / `SMS_ALIYUN_ACCESS_KEY_SECRET`，新代码发布后通过现有手机号提供商运维任务切换 `AUTH_PHONE_PROVIDER=legacy` 并重建主站容器。不要在旧镜像上提前切换或以普通 restart 代替容器重建。密钥不写入 Git、文档或日志。

发布前需核对曾使用原生认证的手机号是否具备 `phone_to_user` 映射及 legacy 会话所需邮箱；原生 `/otp` 失败也可能留下未确认用户，不能通过删除旧用户解决映射问题。完成真实收码、旧账号登录、新注册和首次绑定验收后才能认定切换完成。用户已确认在生产配置中更新密钥并切换 `AUTH_PHONE_PROVIDER=legacy`，授权测试通过后推送 main 发布。应用修改仍需随新镜像上线；真实短信与完整登录验收尚未完成。
