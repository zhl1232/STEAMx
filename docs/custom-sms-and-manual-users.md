# 自定义短信与手动添加用户

因 Supabase 官方短信（Twilio 等）在国内需资质或配置复杂，项目支持**自定义短信接口**和**管理员手动添加用户**。

## 一、自定义短信（替代 Supabase 官方短信）

手机号登录/注册已改为使用项目自己的「发码 + 验证」流程，短信由你配置的接口发送。

### 1. 环境变量

在 `.env.local` 中配置其一即可：

| 变量 | 说明 |
|------|------|
| `SMS_PROVIDER=log` | 不真实发短信，仅在开发环境打日志（默认） |
| `SMS_PROVIDER=aliyun` | 阿里云号码认证服务（Dypnsapi），需配合下表 |
| `SMS_PROVIDER=custom` | 使用自定义 HTTP 接口发短信，需配合下表 |

**阿里云**：只需配置下面两个变量即走阿里云 Dypnsapi，签名与模板在代码内写死（`lib/sms/aliyun.ts` 中 `ALIYUN_SIGN_NAME`、`ALIYUN_TEMPLATE_CODE`，如需修改可改该文件）。

| 变量 | 说明 |
|------|------|
| `SMS_ALIYUN_ACCESS_KEY_ID` | 必填。阿里云 AccessKey ID |
| `SMS_ALIYUN_ACCESS_KEY_SECRET` | 必填。阿里云 AccessKey Secret |

验证时若已配置上述密钥则优先走阿里云 `CheckSmsVerifyCode` 校验；否则走本库 `phone_otps` 表校验。

**手机号登录后的跳转**：验证成功后会通过 Supabase Magic Link 跳回你的站点（优先用请求的 `Origin`，否则用 `NEXT_PUBLIC_SITE_URL` 或本地 `http://localhost:3000`）。请在 Supabase Dashboard → **Authentication** → **URL Configuration** 中把「Redirect URLs」里加上你的站点根地址（如 `http://localhost:3000/`、`https://你的域名/`），否则可能跳转到 Supabase 默认页。

当 `SMS_PROVIDER=custom` 时：

| 变量 | 说明 |
|------|------|
| `SMS_CUSTOM_URL` | **必填**。发短信的 HTTP 地址，项目会向该 URL 发送 POST |
| `SMS_CUSTOM_HEADERS` | 可选。JSON 对象字符串，如 `{"Authorization":"Bearer xxx"}` |

POST 请求体为：

```json
{
  "phone": "+8613800138000",
  "code": "123456"
}
```

你的接口收到后，可调用任意短信服务（阿里云、腾讯云、其他国内厂商）发送验证码，无需在项目里写死某一家。

### 2. 数据库迁移

执行一次迁移以创建 OTP 与手机号映射表：

```bash
pnpm supabase db push
# 或
npx supabase migration up
```

涉及表：`phone_otps`、`phone_to_user`（仅 service_role 可访问）。

### 3. 流程说明

- **发验证码**：前端请求 `POST /api/auth/sms/send`，服务端生成 6 位验证码、写入 `phone_otps`、调用你配置的短信接口。
- **验证并登录**：前端请求 `POST /api/auth/sms/verify`，服务端校验 OTP，若用户不存在则用 Admin API 创建用户（占位邮箱 + 可选密码），再生成 Magic Link 并返回 `redirectUrl`，前端跳转即完成登录。
- **绑定手机号**：已登录用户请求 `POST /api/auth/sms/send`（`type=phone_change`）发送验证码，再调用 `POST /api/auth/sms/verify`（`type=phone_change`）完成绑定。

手机号用户在本系统中以「占位邮箱」形式存在于 Supabase Auth（如 `p_8613800138000@phone.local`），`phone_to_user` 表维护手机号与用户 ID 的对应关系。

> **设置页「绑定手机号」**：已改为自定义短信接口，仅支持首次绑定，不支持换绑/解绑。

---

## 二、管理员手动添加用户（无需短信/邮箱验证）

不依赖短信和邮箱验证，由管理员在后台直接创建「邮箱 + 密码」用户，用户用该邮箱和密码登录即可。

### 1. API

仅 **admin** 角色可调用：

```http
POST /api/admin/users
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "至少6位",
  "displayName": "可选显示名"
}
```

成功返回示例：

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "message": "用户已创建，可使用该邮箱和密码登录。"
}
```

- 若邮箱已存在，会返回 400 及「该邮箱已被注册」。
- 创建后 Supabase 的 `handle_new_user` 触发器会自动插入 `profiles` 记录。

### 2. 调用方式

- 用 Postman / curl 等调用时，需先以管理员账号登录网站，再在请求中携带该账号的 Cookie（与现有登录态一致）。
- 或在管理后台增加「添加用户」表单：输入邮箱、密码、可选显示名，提交时请求 `POST /api/admin/users`。

用户创建后，直接使用**邮箱 + 密码**在登录页登录即可。

---

## 三、安全与限流

- 验证码：同一手机号 60 秒内只能请求一次；验证码约 10 分钟内有效。
- `phone_otps`、`phone_to_user` 已启用 RLS，仅 service_role 可访问，前端无法直接读写。
- 管理员创建用户接口依赖现有 `requireRole(supabase, ['admin'])`，仅管理员可调用。
