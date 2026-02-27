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
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { AvatarUpload } from "./avatar-upload"

import { Skeleton } from "@/components/ui/skeleton"

export function EditProfileDialog({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
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

    // Fetch profile data
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, bio, avatar_url')
      .eq('id', user.id)
      .single()

    if (data) {
      const row = data as { username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null }
      setUsername(row.username || "")
      setDisplayName(row.display_name || "")
      setBio(row.bio || "")
      setAvatarUrl(row.avatar_url || "")
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
    setAvatarUrl(URL.createObjectURL(file))
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

      // Upload avatar if changed
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, selectedFile)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)
        finalAvatarUrl = data.publicUrl
      }

      const { error: _error } = await supabase
        .from('profiles')
        .update({
          username,
          display_name: displayName,
          bio,
          avatar_url: finalAvatarUrl,
          updated_at: new Date().toISOString(),
        } as never)
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
            在这里修改你的个人信息。完成后点击保存。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr,200px] gap-6 py-4">
            <div className="space-y-4">

              <div className="grid gap-2">
                <Label htmlFor="display_name">
                  昵称
                </Label>
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
              <div className="grid gap-2">
                <Label htmlFor="bio">
                  简介
                </Label>
                {fetching ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Input
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="一句话介绍自己"
                  />
                )}
              </div>

              {/* 手机号绑定区域 */}
              <div className="grid gap-2 mt-4 pt-4 border-t">
                <Label>手机号绑定</Label>
                {fetching ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <div className="space-y-3">
                    {bindStep === 'idle' && (
                      <div className="flex gap-2">
                        <Input
                          value={phone}
                          disabled={true}
                          placeholder="暂未绑定手机号"
                          className="bg-muted text-muted-foreground"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setPhone("") // 清空显示内容，准备输入新手机号
                            setBindStep('input')
                            setBindMessage(null)
                          }}
                        >
                          {originalPhone ? '更换' : '绑定'}
                        </Button>
                      </div>
                    )}

                    {bindStep === 'input' && (
                      <div className="flex gap-2">
                        <div className="relative flex flex-1">
                          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                            +86
                          </span>
                          <Input
                            type="tel"
                            placeholder="输入新手机号"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            className="rounded-l-none"
                          />
                        </div>
                        <Button
                          type="button"
                          disabled={!phone || bindingLoading}
                          onClick={handleBindPhone}
                        >
                          {bindingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '发送验证码'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setBindStep('idle')
                            setPhone(originalPhone ? originalPhone.replace(/(\+\d{2})(\d{3})\d{4}(\d{4})/, '$1 $2****$3') : "")
                            setBindMessage(null)
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    )}

                    {bindStep === 'verify' && (
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="输入6位验证码"
                          value={otp}
                          maxLength={6}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        />
                        <Button
                          type="button"
                          disabled={!otp || bindingLoading}
                          onClick={handleVerifyBindOtp}
                        >
                          {bindingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '验证'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setBindStep('input')}
                        >
                          返回
                        </Button>
                      </div>
                    )}

                    {bindMessage && (
                      <p className={`text-sm ${bindMessage.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
                        {bindMessage.text}
                      </p>
                    )}
                  </div>
                )}
              </div>

            </div>

            <div className="flex flex-col items-center justify-start pt-2">
              <Label className="mb-4 text-muted-foreground">头像</Label>
              {fetching ? (
                <Skeleton className="h-32 w-32 rounded-full" />
              ) : (
                <AvatarUpload
                  value={avatarUrl}
                  onFileSelect={handleFileSelect}
                  disabled={loading}
                />
              )}
              <div className="mt-6 w-full text-center">
                {fetching ? (
                  <Skeleton className="h-4 w-20 mx-auto" />
                ) : (
                  <span className="text-sm text-muted-foreground">账号ID： {username || "未设置"}</span>
                )}
              </div>
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
