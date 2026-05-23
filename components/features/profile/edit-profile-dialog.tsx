"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from '@/lib/context/auth-context'
import { useToast } from "@/hooks/use-toast"
import { AvatarUpload } from "./avatar-upload"
import { toE164 } from "@/lib/utils/phone"
import { logger } from "@/lib/logger"
import { compressImageForBucket } from "@/lib/utils/image-compression"

import { Skeleton } from "@/components/ui/skeleton"

export function EditProfileDialog({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [gender, setGender] = useState("")
  const [birthYear, setBirthYear] = useState("")
  const [birthMonth, setBirthMonth] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  /** 已上传的头像 URL，在选择器里始终保留一格，不随切换预设而消失 */
  const [persistedUploadUrl, setPersistedUploadUrl] = useState("")
  const supabase = createClient()
  const router = useRouter()

  const [phone, setPhone] = useState("")
  const [originalPhone, setOriginalPhone] = useState("")
  const [bindStep, setBindStep] = useState<'idle' | 'input' | 'verify'>('idle')
  const [otp, setOtp] = useState("")
  const [bindingLoading, setBindingLoading] = useState(false)
  const [bindMessage, setBindMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Load profile data when dialog opens
  const loadProfile = async () => {
    if (!user) return
    setFetching(true)
    setSelectedFile(null) // Reset selected file
    setBindStep('idle')
    setOtp('')
    setBindMessage(null)

    // Fetch profile data（含 last_uploaded_avatar_url，用于选择器里始终保留「已上传」一格）
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, bio, gender, birth_date, avatar_url, last_uploaded_avatar_url')
      .eq('id', user.id)
      .single()

    if (data) {
      const row = data as unknown as { username: string | null; display_name: string | null; bio: string | null; gender: string | null; birth_date: string | null; avatar_url: string | null; last_uploaded_avatar_url?: string | null }
      setUsername(row.username || "")
      setDisplayName(row.display_name || "")
      setBio(row.bio || "")
      setGender(row.gender || "")
      if (row.birth_date) {
        const [y, m] = row.birth_date.split("-")
        setBirthYear(y)
        setBirthMonth(String(parseInt(m, 10)))
      } else {
        setBirthYear("")
        setBirthMonth("")
      }
      const url = row.avatar_url || ""
      setAvatarUrl(url)
      // 已上传头像：当前是自定义则用当前；否则用库里的 last_uploaded_avatar_url，保存后也会一直存在
      const uploadUrl = (url && !url.startsWith("/avatars/")) ? url : (row.last_uploaded_avatar_url || "")
      if (uploadUrl) setPersistedUploadUrl(uploadUrl)
      else setPersistedUploadUrl("")
    }

    // Refresh user session to get latest phone
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser?.phone) {
      // Show masked phone number for privacy
      const local = currentUser.phone.replace(/^\+?86/, "")
      const masked = local.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
      setPhone(masked)
      setOriginalPhone(currentUser.phone)
    } else {
      setPhone("")
      setOriginalPhone("")
    }

    setFetching(false)
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    const blobUrl = URL.createObjectURL(file)
    setAvatarUrl(blobUrl)
    setPersistedUploadUrl(blobUrl) // 新上传的也始终占一格
  }

  /** 选择本地默认头像（如 /avatars/default-8.svg），不上传文件 */
  const handleDefaultAvatarSelect = (url: string) => {
    setSelectedFile(null)
    setAvatarUrl(url)
  }

  const handleBindPhone = async () => {
    if (!phone || phone === originalPhone) return
    setBindingLoading(true)
    setBindMessage(null)

    try {
      const formattedPhone = toE164(phone)
      const res = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, type: 'phone_change' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '发送验证码失败')

      setBindStep('verify')
      setBindMessage({ type: 'success', text: '验证码已发送，请注意查收短信' })
    } catch (error: unknown) {
      const err = error as Error
      setBindMessage({ type: 'error', text: err.message || '发送验证码失败' })
    } finally {
      setBindingLoading(false)
    }
  }

  const handleVerifyBindOtp = async () => {
    if (!otp) return
    setBindingLoading(true)
    setBindMessage(null)

    try {
      const formattedPhone = toE164(phone)
      const res = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          code: otp,
          type: 'phone_change',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '验证失败，请检查验证码')

      setBindStep('idle')
      // fetch latest mapped phone
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser?.phone) {
        const local = currentUser.phone.replace(/^\+?86/, "")
        setPhone(local.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2"))
        setOriginalPhone(currentUser.phone)
      }
      setBindMessage({ type: 'success', text: '手机号绑定成功！' })
    } catch (error: unknown) {
      const err = error as Error
      setBindMessage({ type: 'error', text: err.message || '验证失败，请检查验证码' })
    } finally {
      setBindingLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)

    try {
      let finalAvatarUrl = avatarUrl

      if (selectedFile) {
        const prepared = await compressImageForBucket(selectedFile, 'avatars')
        const formData = new FormData()
        formData.append('file', prepared)
        formData.append('bucket', 'avatars')

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => null)
          toast({
            title: errData?.error || "图片上传失败，请重试",
            variant: "destructive",
          })
          return
        }

        const uploadData = await uploadRes.json()
        finalAvatarUrl = uploadData.publicUrl
      }
      // 若为本地默认头像（如 /avatars/default-8.svg），finalAvatarUrl 已是相对路径，直接存库即可
      const trimmedUsername = username.trim()

      const response = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(trimmedUsername.length >= 3 ? { username: trimmedUsername } : {}),
          display_name: displayName,
          bio,
          gender: gender || null,
          birth_year: birthYear || null,
          birth_month: birthMonth || null,
          avatar_url: finalAvatarUrl,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || '保存失败，请稍后重试')
      }

      if (data?.profile) {
        const payload = data.profile as {
          username?: string | null
          display_name?: string | null
          bio?: string | null
          gender?: string | null
          birth_year?: string | null
          birth_month?: string | null
          avatar_url?: string | null
          last_uploaded_avatar_url?: string | null
        }
        setUsername(payload.username || username)
        setDisplayName(payload.display_name || "")
        setBio(payload.bio || "")
        setGender(payload.gender || "")
        setBirthYear(payload.birth_year || "")
        setBirthMonth(payload.birth_month || "")
        setAvatarUrl(payload.avatar_url || finalAvatarUrl)
        setPersistedUploadUrl(payload.last_uploaded_avatar_url || "")
      }

      await refreshProfile() // Refresh global profile state
      setOpen(false)
      router.refresh()
      toast({ title: "资料已保存" })
    } catch (error) {
      logger.error("Error updating profile", { error })
      toast({
        title: error instanceof Error ? error.message : "保存失败，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      setOpen(open)
      if (open) loadProfile()
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>编辑资料</DialogTitle>
          <DialogDescription>
            完善资料，让大家更好地认识你
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* 1. 头像 + 账号ID（最上方） */}
            <div className="flex flex-col items-center gap-2">
              {fetching ? (
                <Skeleton className="h-24 w-24 rounded-full" />
              ) : (
                <AvatarUpload
                  value={avatarUrl}
                  persistedUploadUrl={persistedUploadUrl}
                  onFileSelect={handleFileSelect}
                  onDefaultSelect={handleDefaultAvatarSelect}
                  disabled={loading}
                  showCameraBadge
                />
              )}
              {fetching ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span className="text-xs text-muted-foreground">账号ID：{username || "未设置"}</span>
              )}
            </div>

            {/* 2. 昵称 */}
            <div className="grid gap-2">
              <Label htmlFor="display_name">昵称</Label>
              {fetching ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="显示的名称"
                />
              )}
            </div>

            {/* 3. 简介（多行 + 字数限制） */}
            <div className="grid gap-2">
              <Label htmlFor="bio">简介</Label>
              {fetching ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="relative">
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 30))}
                    placeholder="一句话介绍自己"
                    className="min-h-[88px] resize-none pr-12"
                    maxLength={30}
                    rows={3}
                  />
                  <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                    {bio.length}/30
                  </span>
                </div>
              )}
            </div>

            {/* 4. 性别 */}
            <div className="grid gap-2">
              <Label htmlFor="gender">性别</Label>
              {fetching ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={gender || undefined} onValueChange={(v) => setGender(v)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="男">男</SelectItem>
                    <SelectItem value="女">女</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                    <SelectItem value="不愿透露">不愿透露</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 5. 出生年月 */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>出生年月</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setBirthYear(""); setBirthMonth("") }}
                  disabled={!birthYear && !birthMonth}
                >
                  清空
                </Button>
              </div>
              {fetching ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="flex gap-2">
                  <Select value={birthYear || undefined} onValueChange={(v) => setBirthYear(v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="年" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 30 }, (_, i) => {
                        const y = new Date().getFullYear() - 3 - i
                        return <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                  <Select value={birthMonth || undefined} onValueChange={(v) => setBirthMonth(v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="月" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} 月</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {birthYear && birthMonth && (() => {
                const now = new Date()
                const bYear = Number(birthYear)
                const bMonth = Number(birthMonth)
                let age = now.getFullYear() - bYear
                if (now.getMonth() + 1 < bMonth) age--
                return (
                  <p className="text-xs text-muted-foreground">
                    当前年龄：约 {age} 岁
                  </p>
                )
              })()}
            </div>

            {/* 6. 账号安全 - 手机号绑定（列表项样式） */}
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium text-muted-foreground">账号安全</p>
              {fetching ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="space-y-3">
                  {bindStep === "idle" && (
                    <div className="flex items-center justify-between rounded-lg py-2">
                      <span className="text-sm text-muted-foreground">
                        手机号绑定：{phone ? phone : "暂未绑定"}
                      </span>
                      {!originalPhone ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setPhone("")
                            setBindStep("input")
                            setBindMessage(null)
                          }}
                        >
                          去绑定
                        </Button>
                      ) : null}
                    </div>
                  )}

                  {bindStep === "input" && (
                    <div className="space-y-3 rounded-lg border border-input bg-muted/30 p-3">
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-background text-muted-foreground text-sm whitespace-nowrap">
                          +86
                        </span>
                        <Input
                          type="tel"
                          placeholder="输入新手机号"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                          className="rounded-l-none flex-1 bg-background"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBindStep("idle")
                            setPhone(
                              originalPhone
                                ? (() => {
                                    const local = originalPhone.replace(/^\+?86/, "")
                                    return local.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
                                  })()
                                : ""
                            )
                            setBindMessage(null)
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!phone || bindingLoading}
                          onClick={handleBindPhone}
                        >
                          {bindingLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          发送验证码
                        </Button>
                      </div>
                    </div>
                  )}

                  {bindStep === "verify" && (
                    <div className="space-y-3 rounded-lg border border-input bg-muted/30 p-3">
                      <Input
                        type="text"
                        placeholder="输入6位验证码"
                        value={otp}
                        maxLength={6}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-background tracking-widest text-center"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setBindStep("input")}
                        >
                          返回
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!otp || bindingLoading}
                          onClick={handleVerifyBindOtp}
                        >
                          {bindingLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          验证
                        </Button>
                      </div>
                    </div>
                  )}

                  {bindMessage && (
                    <p
                      className={`text-sm ${bindMessage.type === "error" ? "text-destructive" : "text-[hsl(var(--status-success))]"}`}
                    >
                      {bindMessage.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || fetching}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存更改
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
