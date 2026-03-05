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
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { AvatarUpload } from "./avatar-upload"

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
      .select('username, display_name, bio, gender, avatar_url, last_uploaded_avatar_url')
      .eq('id', user.id)
      .single()

    if (data) {
      const row = data as unknown as { username: string | null; display_name: string | null; bio: string | null; gender: string | null; avatar_url: string | null; last_uploaded_avatar_url?: string | null }
      setUsername(row.username || "")
      setDisplayName(row.display_name || "")
      setBio(row.bio || "")
      setGender(row.gender || "")
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
      const masked = currentUser.phone.replace(/(\+\d{2})(\d{3})\d{4}(\d{4})/, '$1 $2****$3')
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
      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`
      const { error } = await supabase.auth.updateUser({
        phone: formattedPhone
      })
      if (error) throw error

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
      const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'phone_change'
      })
      if (error) throw error

      setBindStep('idle')
      setOriginalPhone(formattedPhone)
      // fetch latest mapped phone
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser?.phone) {
        setPhone(currentUser.phone.replace(/(\+\d{2})(\d{3})\d{4}(\d{4})/, '$1 $2****$3'))
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

      // 仅当用户上传了新文件时才上传到 Storage；选择默认头像或未改头像时直接使用当前 avatarUrl
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, selectedFile)

        if (uploadError) {
          toast({
            title: "图片上传失败，请重试",
            variant: "destructive",
          })
          return
        }

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)
        finalAvatarUrl = data.publicUrl
      }
      // 若为本地默认头像（如 /avatars/default-8.svg），finalAvatarUrl 已是相对路径，直接存库即可
      // 本次是上传时：记入 last_uploaded_avatar_url，之后即使用户改回预设，选择器里仍可显示「已上传」一格
      const isCustomUpload = !finalAvatarUrl.startsWith("/avatars/")
      const updatePayload = {
        username,
        display_name: displayName,
        bio,
        gender: gender || null,
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString(),
        ...(isCustomUpload ? { last_uploaded_avatar_url: finalAvatarUrl } : {}),
      } as { username: string; display_name: string; bio: string; gender: string | null; avatar_url: string; updated_at: string; last_uploaded_avatar_url?: string }
      // 选预设时只改 avatar_url，不覆盖 last_uploaded_avatar_url，所以已上传的那格会一直存在
      if (!isCustomUpload) delete updatePayload.last_uploaded_avatar_url

      const { error: _error } = await supabase
        .from('profiles')
        .update(updatePayload as never)
        .eq('id', user.id)

      if (_error) throw _error

      await refreshProfile() // Refresh global profile state
      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Error updating profile:", error)
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

            {/* 5. 账号安全 - 手机号绑定（列表项样式） */}
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
                        {originalPhone ? "更换" : "去绑定"}
                      </Button>
                    </div>
                  )}

                  {bindStep === "input" && (
                    <div className="space-y-2 rounded-lg border border-input bg-muted/30 p-3">
                      <div className="flex flex-wrap gap-2">
                        <div className="relative flex flex-1 min-w-[140px]">
                          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                            +86
                          </span>
                          <Input
                            type="tel"
                            placeholder="输入新手机号"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                            className="rounded-l-none"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!phone || bindingLoading}
                          onClick={handleBindPhone}
                        >
                          {bindingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "发送验证码"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBindStep("idle")
                            setPhone(
                              originalPhone
                                ? originalPhone.replace(/(\+\d{2})(\d{3})\d{4}(\d{4})/, "$1 $2****$3")
                                : ""
                            )
                            setBindMessage(null)
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}

                  {bindStep === "verify" && (
                    <div className="flex flex-wrap gap-2 rounded-lg border border-input bg-muted/30 p-3">
                      <Input
                        type="text"
                        placeholder="输入6位验证码"
                        value={otp}
                        maxLength={6}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        className="max-w-[120px]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!otp || bindingLoading}
                        onClick={handleVerifyBindOtp}
                      >
                        {bindingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "验证"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setBindStep("input")}
                      >
                        返回
                      </Button>
                    </div>
                  )}

                  {bindMessage && (
                    <p
                      className={`text-sm ${bindMessage.type === "error" ? "text-destructive" : "text-green-600"}`}
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
