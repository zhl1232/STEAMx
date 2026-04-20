'use client'

import { useRouter } from 'next/navigation'

import { AuthFlow } from '@/components/auth/auth-flow'

export default function LoginPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.88))] px-4 py-4 sm:px-6 sm:py-6 md:px-8">
      <AuthFlow
        presentation="page"
        title="登录或注册"
        description="移动端优先使用手机号验证码，邮箱密码作为备用方式。登录成功后会自动继续你的原操作。"
        onBack={() => router.back()}
      />
    </div>
  )
}
