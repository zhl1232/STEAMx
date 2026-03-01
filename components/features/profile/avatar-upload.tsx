"use client"

import { useRef, useState } from "react"
import { Upload, Camera, Plus } from "lucide-react"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/** public/avatars 下的预设头像文件名（全部展示，按编号排序） */
const DEFAULT_AVATAR_FILES = [
  "default-1.svg",
  "default-2.svg",
  "default-3.svg",
  "default-4.svg",
  "default-5.svg",
  "default-6.svg",
  "default-7.svg",
  "default-8.svg",
  "default-9.svg",
  "default-10.svg",
  "default-11.svg",
  "default-12.svg",
]

interface AvatarUploadProps {
  value: string
  /** 已上传的头像 URL，在选择器里始终保留一格（不随切换预设而消失） */
  persistedUploadUrl?: string
  onFileSelect: (file: File) => void
  /** 选择预设或当前上传头像时回调，url 为预设路径如 /avatars/default-8.svg 或自定义上传的完整 URL；仅做高亮，提交由外层「保存修改」统一提交 */
  onDefaultSelect?: (url: string) => void
  disabled?: boolean
  /** 在头像右下角显示相机图标，提示可点击更换 */
  showCameraBadge?: boolean
}

/** 判断当前 value 是否为某个预设头像路径 */
function getSelectedPresetFilename(value: string): string | null {
  if (!value || !value.startsWith("/avatars/")) return null
  const name = value.replace("/avatars/", "")
  return DEFAULT_AVATAR_FILES.includes(name) ? name : null
}

export function AvatarUpload({
  value,
  persistedUploadUrl,
  onFileSelect,
  onDefaultSelect,
  disabled,
  showCameraBadge,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { toast } = useToast()

  const selectedPreset = getSelectedPresetFilename(value)

  const validateAndEmit = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "文件格式错误",
        description: "请上传图片文件",
        variant: "destructive",
      })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "图片过大",
        description: "图片大小不能超过 2MB",
        variant: "destructive",
      })
      return
    }
    onFileSelect(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
    setPickerOpen(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return // 用户在系统选择器点击「取消」，不处理
    validateAndEmit(file)
  }

  const handlePresetClick = (filename: string) => {
    onDefaultSelect?.(`/avatars/${filename}`)
  }

  const handlePersistedUploadClick = () => {
    if (persistedUploadUrl) onDefaultSelect?.(persistedUploadUrl)
  }

  const handleCustomUploadClick = () => {
    fileInputRef.current?.click()
    // 不添加 capture，由系统弹出「拍照 / 图库 / 文件」选择
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="relative group cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-background shadow-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center transition-all group-hover:opacity-90 relative">
              {value ? (
                <OptimizedImage
                  src={value}
                  alt="Avatar"
                  fill
                  variant="avatar"
                  className="object-cover"
                />
              ) : (
                <span className="text-5xl font-bold text-primary-foreground">
                  <Upload className="h-10 w-10" />
                </span>
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full backdrop-blur-[2px]">
              <span className="text-white font-medium text-sm border border-white/50 px-3 py-1 rounded-full bg-black/20">
                更换
              </span>
            </div>
            {showCameraBadge && (
              <span
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow"
                aria-hidden
              >
                <Camera className="h-4 w-4" />
              </span>
            )}
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[360px] top-[62%] translate-y-[-50%]" hideOverlay>
          <DialogHeader>
            <DialogTitle>选择头像</DialogTitle>
          </DialogHeader>

          {/* 模块 A：预设头像库（含已上传的头像） */}
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {/* 已上传的头像：始终占一格，切换预设后仍可点回 */}
              {persistedUploadUrl ? (
                <button
                  type="button"
                  onClick={handlePersistedUploadClick}
                  className={cn(
                    "h-14 w-14 rounded-full overflow-hidden border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    value === persistedUploadUrl
                      ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                >
                  {persistedUploadUrl.startsWith("blob:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={persistedUploadUrl} alt="已上传" className="h-full w-full object-cover" />
                  ) : (
                    <OptimizedImage
                      src={persistedUploadUrl}
                      alt="已上传"
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ) : null}
              {DEFAULT_AVATAR_FILES.map((filename) => {
                const isSelected = selectedPreset === filename
                return (
                  <button
                    key={filename}
                    type="button"
                    onClick={() => handlePresetClick(filename)}
                    className={cn(
                      "h-14 w-14 rounded-full overflow-hidden border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/avatars/${filename}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                )
              })}
            </div>
          </div>

          {/* 模块 B：自定义上传（统一入口，不区分拍照/相册，由系统选择器决定） */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">自定义上传</p>
            <button
              type="button"
              onClick={handleCustomUploadClick}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-input bg-background py-8 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Plus className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">自定义上传</span>
              <span className="text-xs text-muted-foreground">
                （支持拍照/从相册选择）
              </span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
