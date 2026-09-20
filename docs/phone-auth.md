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
