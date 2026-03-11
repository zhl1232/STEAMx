# 🔐 Supabase 认证配置指南

## 🎯 目标
配置 Supabase Authentication，启用邮箱登录和 OAuth 提供商（GitHub、Google）。

---

## 📋 配置步骤

### Step 1: 打开 Supabase 认证设置

1. 登录 https://supabase.com
2. 选择你的项目
3. 点击左侧 **Authentication** (钥匙图标 🔑)
4. 点击 **Providers** 标签

---

### Step 2: 配置邮箱认证

邮箱认证默认已启用，但需要配置：

1. 在 Providers 列表找到 **Email**
2. 确保 **Enable Email provider** 已勾选
3. **重要**：配置邮箱确认设置
   - **Confirm email**: 建议关闭（开发阶段）
   - **Secure email change**: 建议关闭（开发阶段）
4. 点击 **Save** 保存

**⚠️ 开发阶段建议**：
- 关闭邮箱确认，方便测试
- 生产环境务必开启邮箱确认

---

### Step 3: 配置 GitHub OAuth（可选 - 已跳过）

> **注意**：当前阶段我们仅使用邮箱登录，此步骤可跳过。如果未来需要支持 GitHub 登录，可回来配置。

#### 3.1 在 GitHub 创建 OAuth App

1. 访问 https://github.com/settings/developers
2. 点击 **New OAuth App**
3. 填写信息：
   - **Application name**: STEAM 探索 (或你喜欢的名字)
   - **Homepage URL**: `http://localhost:3000` (开发) 或你的域名
   - **Authorization callback URL**: 
     ```
     https://你的项目ID.supabase.co/auth/v1/callback
     ```
     示例：`https://mqdytcgfduhujabuahzv.supabase.co/auth/v1/callback`
4. 点击 **Register application**
5. 复制 **Client ID** 和 **Client Secret**

#### 3.2 在 Supabase 配置 GitHub

1. 回到 Supabase → Authentication → Providers
2. 找到 **GitHub**
3. 启用 **Enable GitHub provider**
4. 粘贴刚才的：
   - **GitHub Client ID**
   - **GitHub Client Secret**
5. 点击 **Save**

---

### Step 4: 配置 Google OAuth（可选 - 已跳过）

> **注意**：当前阶段我们仅使用邮箱登录，此步骤可跳过。

#### 4.1 在 Google Cloud 创建 OAuth 凭据

1. 访问 https://console.cloud.google.com
2. 创建新项目或选择现有项目
3. 导航到 **APIs & Services** → **Credentials**
4. 点击 **Create Credentials** → **OAuth client ID**
5. 选择 **Application type**: Web application
6. 填写：
   - **Name**: STEAM 探索
   - **Authorized redirect URIs**: 
     ```
     https://你的项目ID.supabase.co/auth/v1/callback
     ```
7. 点击 **Create**
8. 复制 **Client ID** 和 **Client Secret**

#### 4.2 在 Supabase 配置 Google

1. Supabase → Authentication → Providers
2. 找到 **Google**
3. 启用 **Enable Google provider**
4. 粘贴：
   - **Google Client ID**
   - **Google Client Secret**
5. 点击 **Save**

---

### Step 5: 配置重定向 URL

1. 在 Supabase → Authentication → **URL Configuration**
2. 添加 **Redirect URLs**：
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000
   ```
3. 如果有生产域名，也添加上：
   ```
   https://yourdomain.com/auth/callback
   https://yourdomain.com
   ```
4. 点击 **Save**

---

## ✅ 验证配置

### 测试邮箱登录

1. 访问 http://localhost:3000/login
2. 输入邮箱和密码（8位以上）
3. 点击 **注册**
4. 如果成功，会自动登录并跳转到首页
5. 右上角应该显示用户头像和退出按钮

### 测试 OAuth 登录

1. 访问 http://localhost:3000/login
2. 点击 **使用 GitHub 登录** 或 **使用 Google 登录**
3. 完成 OAuth 授权流程
4. 成功后会重定向回首页并显示已登录

---

## 🎨 快速配置（仅开发测试）

如果你只是想快速测试，最简单的方式：

### 仅使用邮箱登录（无需 OAuth）

1. Supabase → Authentication → Providers
2. 确保 **Email** 已启用
3. 关闭 **Confirm email**
4. 保存

**就这样！** 现在可以直接注册测试账号了。

---

## 📊 查看用户

配置完成后，创建的用户会显示在：

**Supabase → Authentication → Users**

你可以看到：
- 用户邮箱
- 创建时间
- 最后登录时间
- 登录方式（email / github / google）

---

## ⚠️ 常见问题

### Q: OAuth 登录后没反应？

**检查清单**：
1. Redirect URL 是否正确配置
2. GitHub/Google 的回调 URL 是否正确
3. 浏览器控制台有无错误
4. 检查 Supabase 的 Logs（Real-time logs）

### Q: 邮箱注册失败？

**可能原因**：
1. 密码少于 8 位
2. 邮箱格式不正确
3. 邮箱已被注册
4. 网络连接问题

### Q: 如何重置用户密码？

在 Supabase → Authentication → Users：
1. 找到对应用户
2. 点击 **...** → **Reset password**
3. 用户会收到重置链接（如果配置了邮件服务）

---

## 🚀 生产环境配置

部署到 Vercel 时：

### 1. 更新 OAuth 回调 URL

在 GitHub/Google OAuth App 中添加生产域名：
```
https://yourdomain.com/auth/callback
```

### 2. 更新 Supabase Redirect URLs

添加生产域名：
```
https://yourdomain.com/auth/callback
https://yourdomain.com
```

### 3. 启用邮箱确认

生产环境务必启用：
- **Confirm email**: ✅ 开启
- **Secure email change**: ✅ 开启

---

## 📧 配置邮件服务（可选）

Supabase 默认使用内置邮件服务，但有限制。

**推荐生产环境配置自定义 SMTP**：

1. Supabase → Project Settings → **Auth**
2. 滚动到 **SMTP Settings**
3. 配置你的 SMTP 服务器（如 SendGrid、Mailgun）

---

## 🎉 完成！

配置完成后：
- ✅ 用户可以邮箱注册/登录
- ✅ 用户可以 GitHub/Google 登录
- ✅ 登录状态会在页面中显示
- ✅ 可以退出登录

下一步：更新前端页面使用真实的用户数据！
