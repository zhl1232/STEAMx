# Supabase 手机号注册与绑定说明

## 1. supabase-js 安装与使用

项目已安装 `@supabase/supabase-js`（见 `package.json`）。使用前创建客户端：

```ts
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

## 2. 两种手机号流程对比

### 2.1 手机号「注册/登录」（无密码，OTP）

- **发验证码**：`signInWithOtp({ phone })`（若用户不存在会自动创建）
- **验证**：`verifyOtp({ phone, token, type: 'sms' })`

代码位置：`app/login/page.tsx`（手机号登录/注册）

### 2.2 手机号 + 密码注册（你提到的 signUp 写法）

```ts
// 1. 注册：发短信验证码
const { data, error } = await supabase.auth.signUp({
  phone: '+86xxxxxxxxx',
  password: 'password',
  options: {
    data: { first_name: 'John', age: 27 }
  }
})
// 2. 用户收到短信后，用验证码确认
const { data, error } = await supabase.auth.verifyOtp({
  phone: '+86xxxxxxxxx',  // 必须与 signUp 时一致
  token: '123456',
  type: 'sms'
})
```

当前登录页**没有**「手机号+密码注册」入口，只有「手机号 OTP 登录」（即上面的 2.1）。若需要「手机号+密码注册」，需在登录页增加该流程并如上调用 `signUp` + `verifyOtp`。

### 2.3 已登录用户「绑定/更换手机号」

- **发验证码**：`updateUser({ phone })`
- **验证**：`verifyOtp({ phone, token, type: 'phone_change' })`

代码位置：`app/settings/security/page.tsx`、`components/features/profile/edit-profile-dialog.tsx`。

**注意**：`verifyOtp` 的 `type` 必须与发码方式一致：

| 发码方式              | verifyOtp 的 type   |
|-----------------------|---------------------|
| signInWithOtp / signUp | `'sms'`             |
| updateUser({ phone })  | `'phone_change'`    |

用错 type 会报错。

## 3. 常见报错原因与排查

### 3.1 Supabase 未开启手机号或未配置短信

- 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目 → **Authentication** → **Providers** → **Phone**，确认已开启。
- 配置 **SMS 提供商**（Twilio、MessageBird、Vonage 等），否则会报类似：
  - `SMS provider not configured`
  - `Failed to send SMS`

### 3.2 手机号格式（E.164）

- 必须为国际格式，例如：`+8613800138000`。
- 不要包含空格、括号、短横线（如 `+86 138 0013 8000`、`138-0013-8000`）。
- 发码与验证时使用的 `phone` 必须**完全一致**（包括是否带 `+`）。

### 3.3 验证码 type 用错

- 用 `signInWithOtp` 或 `signUp(phone)` 发的验证码 → 必须用 `type: 'sms'`。
- 用 `updateUser({ phone })` 发的验证码 → 必须用 `type: 'phone_change'`。

### 3.4 限流与过期

- 同一手机号约 **60 秒内只能请求一次** OTP，否则可能报限流错误。
- 验证码有时效（文档约 60 秒内验证，部分环境 1 小时内有效），过期后需重新获取。

### 3.5 中国大陆号码

- 使用 Twilio 等时，对中国大陆号码可能有地区限制或需单独配置，若仅国内号收不到或报错，需在对应 SMS 提供商侧检查。

### 3.6 如何看到具体报错

- 在浏览器控制台查看 `error` 对象，或把 `error?.message` 显示在页面上（开发阶段），便于确认是「未配置 SMS」「格式错误」「type 错误」还是「限流/过期」。

## 4. 项目内调用汇总

| 场景           | 发码 API                    | 验证 API                          |
|----------------|-----------------------------|------------------------------------|
| 登录页-手机号  | `signInWithOtp({ phone })`  | `verifyOtp({ phone, token, type: 'sms' })` |
| 设置-绑定手机  | `updateUser({ phone })`     | `verifyOtp({ phone, token, type: 'phone_change' })` |
| 资料弹窗-绑定  | `updateUser({ phone })`     | `verifyOtp({ phone, token, type: 'phone_change' })` |

当前实现中，**登录页**使用 `type: 'sms'`，**绑定/更换手机**使用 `type: 'phone_change'`，与上述规则一致。若仍报错，请按 3.1～3.6 逐项检查，并优先查看 Supabase 控制台与浏览器中的 `error.message`。
