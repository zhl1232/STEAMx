'use client'

import { useRouter } from 'next/navigation'

import { AuthFlow } from '@/components/auth/auth-flow'

export default function LoginPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-6 sm:px-6 sm:py-8">
      <AuthFlow
        presentation="page"
        title="登录或注册"
        onBack={() => router.back()}
      />
    </div>
  )
}
