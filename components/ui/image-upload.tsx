"use client"

import { useState, useRef, useEffect } from 'react'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Upload, X, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadFile, generateFilePath, validateFileType, validateFileSize } from '@/lib/utils/upload'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  bucket?: string
  pathPrefix?: string
  maxSizeMB?: number
  aspectRatio?: string
  placeholder?: string
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'project-images',
  pathPrefix = 'projects',
  maxSizeMB = 5,
  aspectRatio = 'aspect-video',
  placeholder = '点击上传图片'
}: ImageUploadProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync previewUrl with external value changes
  useEffect(() => {
    setPreviewUrl(value || null)
  }, [value])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // 验证文件类型
    if (!validateFileType(file)) {
      toast({
        title: '文件类型不支持',
        description: '请上传 JPG、PNG、GIF 或 WebP 格式的图片',
        variant: 'destructive'
      })
      return
    }

    // 验证文件大小
    if (!validateFileSize(file, maxSizeMB)) {
      toast({
        title: '文件太大',
        description: `图片大小不能超过 ${maxSizeMB}MB`,
        variant: 'destructive'
      })
      return
    }

    setIsUploading(true)

    try {
      // 生成文件路径
      const filePath = generateFilePath(user.id, file.name, pathPrefix)

      // 上传文件
      const publicUrl = await uploadFile(file, bucket, filePath)

      if (publicUrl) {
        setPreviewUrl(publicUrl)
        onChange(publicUrl)
        toast({
          title: '上传成功',
          description: '图片已成功上传'
        })
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: '上传失败',
        description: '图片上传失败，请重试',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
      // 清空 input，允许重新选择相同文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className={`relative ${aspectRatio} w-full overflow-hidden rounded-lg border-2 border-dashed bg-muted/50 transition-colors hover:bg-muted`}>
        {previewUrl ? (
          <>
            <OptimizedImage
              src={previewUrl}
              alt="Preview"
              fill
              variant="cover"
              className="object-cover"
            />
            <div className="absolute top-2 right-2 z-10">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <span className="text-sm">上传中...</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm">{placeholder}</span>
                <span className="text-xs text-muted-foreground">
                  支持 JPG、PNG、GIF、WebP，最大 {maxSizeMB}MB
                </span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      {previewUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          更换图片
        </Button>
      )}
    </div>
  )
}
