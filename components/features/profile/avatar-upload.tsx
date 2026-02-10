"use client"

import { useRef } from "react"
import { Upload } from "lucide-react"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { useToast } from "@/hooks/use-toast"

interface AvatarUploadProps {
  value: string
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export function AvatarUpload({ value, onFileSelect, disabled }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "文件格式错误",
        description: "请上传图片文件",
        variant: "destructive",
      })
      return
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "文件过大",
        description: "图片大小不能超过 2MB",
        variant: "destructive",
      })
      return
    }

    onFileSelect(file)
    
    // Reset input so the same file can be selected again if needed (though usually not needed here)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group cursor-pointer" onClick={() => !disabled && fileInputRef.current?.click()}>
        <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-background shadow-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center transition-all group-hover:opacity-90">
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
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full backdrop-blur-[2px]">
          <span className="text-white font-medium text-sm border border-white/50 px-3 py-1 rounded-full bg-black/20">更换</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  )
}
