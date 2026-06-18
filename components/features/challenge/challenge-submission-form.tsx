"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, Video, Wand2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { uploadFileSecureWithProgress } from '@/lib/utils/upload'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { logger } from '@/lib/logger'
import type { Challenge, ChallengeStage, ChallengeSubmission, StageProgress } from '@/lib/mappers/types'
import type { ChallengeSubmissionDraft } from '@/lib/pbl/challenge-submission-draft'

const MAX_IMAGES = 9
const MAX_VIDEO_SIZE_MB = 30

async function buildStagePrefill(
  challengeId: number,
  stages: ChallengeStage[],
): Promise<{ notes: string; images: string[] }> {
  try {
    const res = await fetch(`/api/challenges/${challengeId}/stages`)
    if (!res.ok) return { notes: '', images: [] }
    const progress = ((await res.json()).progress ?? []) as StageProgress[]
    if (progress.length === 0) return { notes: '', images: [] }

    const sorted = [...progress].sort((a, b) => a.stageIndex - b.stageIndex)
    const sections: string[] = []
    const images: string[] = []

    for (const item of sorted) {
      const stageTitle = stages[item.stageIndex]?.title || `阶段 ${item.stageIndex + 1}`
      const parts: string[] = []
      if (item.notes?.trim()) parts.push(item.notes.trim())
      if (typeof item.data?.summary === 'string' && item.data.summary.trim()) {
        parts.push(item.data.summary.trim())
      }
      if (parts.length > 0) sections.push(`【${stageTitle}】${parts.join('\n')}`)
      for (const image of item.images) {
        if (!images.includes(image) && images.length < MAX_IMAGES) images.push(image)
      }
    }

    return { notes: sections.join('\n\n'), images }
  } catch {
    return { notes: '', images: [] }
  }
}

interface UploadingImage {
  id: string
  file: File
  preview: string
  progress: number
  error?: string
}

type VideoUploadStatus = 'idle' | 'validating' | 'uploading' | 'done' | 'error'

function uploadVideoWithProgress(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
  abortSignal?: { xhr?: XMLHttpRequest },
): Promise<{ url: string } | { error: string } | null> {
  return new Promise((resolve) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    if (abortSignal) abortSignal.xhr = xhr
    xhr.open('POST', '/api/upload-video')

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText)
          resolve(payload.publicUrl ? { url: payload.publicUrl } : { error: '服务端未返回视频地址' })
        } catch {
          resolve({ error: '解析服务端响应失败' })
        }
      } else {
        resolve({ error: '视频上传失败' })
      }
    }

    xhr.onerror = () => resolve({ error: '网络错误，请稍后重试' })
    xhr.onabort = () => resolve(null)
    xhr.send(formData)
  })
}

interface ChallengeSubmissionFormProps {
  challengeId: number
}

export function ChallengeSubmissionForm({ challengeId }: ChallengeSubmissionFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading } = useAuth()
  const { promptLogin } = useLoginPrompt()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [submission, setSubmission] = useState<ChallengeSubmission | null>(null)
  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)
  const [generatedDraft, setGeneratedDraft] = useState<ChallengeSubmissionDraft | null>(null)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [proofImages, setProofImages] = useState<string[]>([])
  const [proofCaptions, setProofCaptions] = useState<string[]>([])
  const [uploading, setUploading] = useState<UploadingImage[]>([])
  const [referenceProjectIds, setReferenceProjectIds] = useState<number[]>([])

  const [videoUrl, setVideoUrl] = useState('')
  const [videoUploadStatus, setVideoUploadStatus] = useState<VideoUploadStatus>('idle')
  const [videoUploadProgress, setVideoUploadProgress] = useState(0)
  const videoAbortRef = useRef<{ xhr?: XMLHttpRequest }>({})
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const videoAbort = videoAbortRef.current
    return () => {
      videoAbort.xhr?.abort()
    }
  }, [])

  useEffect(() => {
    if (loading) return

    let cancelled = false

    const bootstrap = async () => {
      setIsBootLoading(true)
      const challengeResponse = await fetch(`/api/challenges/${challengeId}`)

      if (cancelled) return

      if (!challengeResponse.ok) {
        setChallenge(null)
        setIsBootLoading(false)
        return
      }

      const challengePayload = await challengeResponse.json()
      setChallenge(challengePayload.challenge || null)
      if (!user) {
        setSubmission(null)
      }

      if (user) {
        const submissionResponse = await fetch(`/api/challenges/${challengeId}/submission`)
        if (cancelled) return

        if (submissionResponse.ok) {
          const submissionPayload = await submissionResponse.json()
          const currentSubmission = (submissionPayload.submission || null) as ChallengeSubmission | null
          setSubmission(currentSubmission)
          if (currentSubmission) {
            setTitle(currentSubmission.title)
            setNotes(currentSubmission.notes || '')
            setIsPublic(currentSubmission.isPublic)
            setProofImages(currentSubmission.proofImages || [])
            setProofCaptions(currentSubmission.proofCaptions || (currentSubmission.proofImages || []).map(() => ''))
            setVideoUrl(currentSubmission.proofVideoUrl || '')
            setReferenceProjectIds(currentSubmission.referenceProjects.map((project) => project.id))
          } else {
            const prefill = await buildStagePrefill(challengeId, challengePayload.challenge?.stages || [])
            if (cancelled) return
            setTitle('')
            setNotes(prefill.notes)
            setIsPublic(true)
            setProofImages(prefill.images)
            setProofCaptions(prefill.images.map(() => ''))
            setVideoUrl('')
            setReferenceProjectIds([])
          }
        }
      }

      setIsBootLoading(false)
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [challengeId, loading, user])

  const totalImages = proofImages.length + uploading.length
  const isReadOnly = challenge?.status !== 'active'

  const uploadImages = useCallback(async (files: FileList | File[]) => {
    if (!user) return

    const candidates = Array.from(files).filter((file) => file.type.startsWith('image/'))
    const remaining = MAX_IMAGES - totalImages
    const batch = candidates.slice(0, Math.max(0, remaining))

    if (batch.length === 0) {
      toast({ title: '最多上传 9 张图片', variant: 'destructive' })
      return
    }

    const newItems = batch.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }))

    setUploading((current) => [...current, ...newItems])

    await Promise.all(newItems.map(async (item) => {
      const url = await uploadFileSecureWithProgress(
        item.file,
        'project-completions',
        (loaded, total) => {
          const progress = Math.round((loaded / total) * 100)
          setUploading((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress } : entry))
        },
        'challenge-submissions',
      )

      if (url) {
        setProofImages((current) => [...current, url])
        setProofCaptions((current) => [...current, ''])
        setUploading((current) => current.filter((entry) => entry.id !== item.id))
        URL.revokeObjectURL(item.preview)
      } else {
        setUploading((current) => current.map((entry) => entry.id === item.id ? { ...entry, error: '上传失败' } : entry))
      }
    }))
  }, [toast, totalImages, user])

  const handleVideoSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast({ title: `视频不能超过 ${MAX_VIDEO_SIZE_MB}MB`, variant: 'destructive' })
      return
    }

    setVideoUploadStatus('validating')
    const result = await uploadVideoWithProgress(file, (loaded, total) => {
      setVideoUploadStatus('uploading')
      setVideoUploadProgress(Math.round((loaded / total) * 100))
    }, videoAbortRef.current)

    if (!result) {
      setVideoUploadStatus('idle')
      return
    }

    if ('error' in result) {
      setVideoUploadStatus('error')
      toast({ title: '视频上传失败', description: result.error, variant: 'destructive' })
      return
    }

    setVideoUrl(result.url)
    setVideoUploadStatus('done')
    setVideoUploadProgress(100)
  }, [toast])

  const handleToggleProject = (projectId: number, checked: boolean) => {
    setReferenceProjectIds((current) => checked ? [...current, projectId] : current.filter((id) => id !== projectId))
  }

  const recommendedProjects = useMemo(() => challenge?.recommendedProjects || [], [challenge?.recommendedProjects])
  const submissionChecks = [
    { label: '作品标题', done: Boolean(title.trim()) },
    { label: '作品图片', done: proofImages.length > 0 },
    { label: '过程说明', done: Boolean(notes.trim()) },
    { label: '公开状态', done: isPublic },
    { label: '参考项目', done: referenceProjectIds.length > 0 || recommendedProjects.length === 0 },
  ]
  const doneChecks = submissionChecks.filter((item) => item.done).length

  const applySubmissionDraft = useCallback((draft: ChallengeSubmissionDraft) => {
    const nextImages = [...proofImages]
    for (const image of draft.images) {
      if (!nextImages.includes(image) && nextImages.length < MAX_IMAGES) nextImages.push(image)
    }

    setTitle(draft.title)
    setNotes(draft.notes)
    setProofImages(nextImages)
    setProofCaptions((captions) => {
      const padded = captions.slice(0, nextImages.length)
      while (padded.length < nextImages.length) padded.push('')
      return padded
    })
    setGeneratedDraft(draft)
  }, [proofImages])

  const handleGenerateDraft = useCallback(async () => {
    if (!user) {
      promptLogin(() => router.refresh(), {
        title: '登录后整理投稿草稿',
        description: '登录后即可把阶段记录整理成可编辑的挑战投稿草稿。',
      })
      return
    }

    setIsGeneratingDraft(true)

    try {
      const response = await fetch(`/api/challenges/${challengeId}/submission/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_ai: true }),
      })
      const payload = await response.json().catch(() => ({}))
      const draft = payload.draft as ChallengeSubmissionDraft | undefined

      if (draft) {
        applySubmissionDraft(draft)
      }

      if (!response.ok && !draft) {
        throw new Error(payload?.error || '草稿整理失败')
      }

      toast({
        title: draft?.source === 'ai' ? '投稿草稿已整理' : '已生成本地草稿',
        description: payload.warning || payload.error || '标题、说明、图片和 STEAM 收获已填入表单，可继续修改。',
        variant: response.ok ? 'default' : 'destructive',
      })
    } catch (error) {
      logger.error('Challenge submission draft generation failed', { error })
      toast({
        title: '草稿整理失败',
        description: error instanceof Error ? error.message : '请稍后再试',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingDraft(false)
    }
  }, [applySubmissionDraft, challengeId, promptLogin, router, toast, user])

  const handleSubmit = async () => {
    if (!user) {
      promptLogin(() => router.refresh(), {
        title: '登录后提交挑战作品',
        description: '登录后即可上传挑战作品、关联参考项目。',
      })
      return
    }

    if (!title.trim()) {
      toast({ title: '请填写作品标题', variant: 'destructive' })
      return
    }

    if (proofImages.length === 0) {
      toast({ title: '请至少上传一张作品图片', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        title: title.trim(),
        notes: notes.trim() || null,
        proof_images: proofImages,
        proof_captions: proofCaptions.map((caption) => caption.trim()),
        proof_video_url: videoUrl || null,
        is_public: isPublic,
        reference_project_ids: referenceProjectIds,
      }

      const response = await fetch(`/api/challenges/${challengeId}/submission`, {
        method: submission ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const responsePayload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(responsePayload?.error || '提交失败')
      }

      toast({
        title: submission ? '挑战作品已更新' : '挑战作品已提交',
        description: '作品会在审核通过后显示在挑战作品墙中。',
      })
      router.push(`/pbl/${challengeId}`)
      router.refresh()
    } catch (error) {
      logger.error('Challenge submission save failed', { error })
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || isBootLoading) {
    return (
      <div className="surface-panel px-6 py-12 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
        正在加载提交信息...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="surface-panel space-y-4 px-6 py-12 text-center">
        <p className="text-lg font-semibold">登录后提交挑战作品</p>
        <p className="text-sm text-muted-foreground">挑战作品会直接挂在挑战下，不再依赖项目页。</p>
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={() => {
              promptLogin(() => router.refresh(), {
                title: '登录后提交挑战作品',
                description: '登录后即可上传图片、视频并关联参考项目。',
              })
            }}
          >
            去登录
          </Button>
        </div>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="surface-panel px-6 py-12 text-center text-muted-foreground">
        未找到挑战信息。
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="surface-panel p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="section-kicker">挑战作品</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {submission ? '更新挑战作品' : '提交挑战作品'}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
              {challenge.title}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/74 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{doneChecks}/5</span> 项信息已确认
          </div>
        </div>

        {!isReadOnly ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">从阶段记录整理投稿草稿</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                自动汇总工作台里的文字、图片、反馈和 STEAM 收获，生成后仍可手动编辑。
              </p>
            </div>
            <Button
              type="button"
              onClick={handleGenerateDraft}
              disabled={isGeneratingDraft}
              shape="pill"
            >
              {isGeneratingDraft ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              {isGeneratingDraft ? '整理中...' : '整理投稿草稿'}
            </Button>
          </div>
        ) : null}

        {submission?.status === 'rejected' && submission.rejectionReason ? (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            审核意见：{submission.rejectionReason}
          </div>
        ) : null}

        {submission?.status === 'pending' ? (
          <div className="mt-4 rounded-md border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-800">
            当前作品正在审核中。继续修改后会重新进入审核。
          </div>
        ) : null}

        {submission?.status === 'approved' ? (
          <div className="mt-4 rounded-md border border-emerald-300/60 bg-emerald-50/70 p-4 text-sm text-emerald-800">
            当前作品已审核通过。继续修改后会重新进入审核。
          </div>
        ) : null}

        {isReadOnly ? (
          <div className="mt-4 rounded-md border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            挑战已结束，作品现在仅可查看，不能继续修改。
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface-panel space-y-5 p-5 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="challenge-submission-title">作品标题</Label>
            <Input
              id="challenge-submission-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：两周气压火箭迭代记录"
              disabled={isReadOnly}
            />
          </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label>作品图片</Label>
            <span className="text-xs text-muted-foreground">{proofImages.length}/{MAX_IMAGES}</span>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void uploadImages(event.target.files)
              event.target.value = ''
            }}
            disabled={isReadOnly}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => imageInputRef.current?.click()}
            disabled={isReadOnly || totalImages >= MAX_IMAGES}
          >
            <Upload className="mr-2 h-4 w-4" />
            上传图片
          </Button>

          <div className="grid gap-4 md:grid-cols-2">
            {proofImages.map((image, index) => (
              <div key={`${image}-${index}`} className="space-y-2 rounded-md border border-border/70 p-3">
                <div className="relative aspect-video overflow-hidden rounded-sm bg-muted">
                  <OptimizedImage src={image} alt={`作品图 ${index + 1}`} fill variant="cover" className="object-cover" />
                  {!isReadOnly ? (
                    <button
                      type="button"
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                      onClick={() => {
                        setProofImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
                        setProofCaptions((current) => current.filter((_, currentIndex) => currentIndex !== index))
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <Input
                  value={proofCaptions[index] || ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setProofCaptions((current) => current.map((caption, currentIndex) => currentIndex === index ? value : caption))
                  }}
                  placeholder="给这张图补一句说明（可选）"
                  disabled={isReadOnly}
                />
              </div>
            ))}

            {uploading.map((item) => (
              <div key={item.id} className="space-y-2 rounded-md border border-border/70 p-3">
                <div className="relative aspect-video overflow-hidden rounded-sm bg-muted">
                  <OptimizedImage src={item.preview} alt="上传中" fill variant="cover" className="object-cover opacity-75" />
                </div>
                <Progress value={item.progress} />
                <p className="text-xs text-muted-foreground">{item.error || `上传中 ${item.progress}%`}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>作品视频（可选）</Label>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoSelect}
            disabled={isReadOnly}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()} disabled={isReadOnly}>
              <Video className="mr-2 h-4 w-4" />
              {videoUrl ? '更换视频' : '上传视频'}
            </Button>
            {videoUrl && !isReadOnly ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setVideoUrl('')
                  setVideoUploadStatus('idle')
                  setVideoUploadProgress(0)
                }}
              >
                移除视频
              </Button>
            ) : null}
          </div>
          {videoUploadStatus === 'uploading' ? <Progress value={videoUploadProgress} /> : null}
          {videoUrl ? (
            <video controls className="w-full rounded-md border border-border/70 bg-black">
              <source src={videoUrl} />
            </video>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="challenge-submission-notes">作品说明与反思</Label>
          <Textarea
            id="challenge-submission-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="这份作品解决了什么问题？你做了哪些调整？哪些证据最能说明你的过程？"
            className="min-h-[180px]"
            disabled={isReadOnly}
          />
          {generatedDraft?.steamInsights.length ? (
            <div className="grid gap-2 pt-2 md:grid-cols-2">
              {generatedDraft.steamInsights.map((item) => (
                <div key={`${item.key}-${item.evidence}`} className="rounded-md border border-border/70 bg-muted/35 p-3">
                  <p className="text-sm font-semibold text-foreground">{item.label}收获</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.evidence}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <Label>参考项目</Label>
          {recommendedProjects.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {recommendedProjects.map((project) => {
                const checked = referenceProjectIds.includes(project.id)
                return (
                  <label
                    key={project.id}
                    className="flex items-start gap-3 rounded-md border border-border/70 p-4 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) => handleToggleProject(project.id, Boolean(next))}
                      disabled={isReadOnly}
                    />
                    <span>
                      <span className="block font-medium text-foreground">{project.title}</span>
                      <span className="mt-1 block text-muted-foreground">把它作为这份挑战作品的参考任务之一。</span>
                    </span>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">当前挑战还没有配置参考项目。</p>
          )}
        </div>

        <label className="flex items-start gap-3 rounded-md border border-border/70 p-4 text-sm">
          <Checkbox
            checked={isPublic}
            onCheckedChange={(next) => setIsPublic(Boolean(next))}
            disabled={isReadOnly}
          />
          <span>
            <span className="block font-medium text-foreground">公开展示到挑战作品墙</span>
            <span className="mt-1 block text-muted-foreground">只有公开且审核通过的挑战作品会显示在作品墙里。</span>
          </span>
        </label>

          <div className="sticky bottom-0 z-20 -mx-5 flex flex-wrap justify-end gap-3 border-t border-border/60 bg-background/92 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-0">
            <Button type="button" variant="outline" onClick={() => router.push(`/pbl/${challengeId}`)}>
              返回挑战
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting || isReadOnly}>
              {isSubmitting ? '提交中...' : submission ? '保存更新' : '提交作品'}
            </Button>
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <section className="surface-subtle p-4">
              <p className="section-kicker">提交检查</p>
              <h2 className="mt-3 text-lg font-semibold tracking-tight">作品墙展示信息</h2>
              <div className="mt-4 space-y-2">
                {submissionChecks.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md bg-background/72 px-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={item.done ? 'font-medium text-primary' : 'text-muted-foreground'}>
                      {item.done ? '完成' : '待补充'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {generatedDraft?.steamInsights.length ? (
              <section className="surface-subtle p-4">
                <p className="section-kicker">草稿来源</p>
                <h2 className="mt-3 text-lg font-semibold tracking-tight">
                  {generatedDraft.source === 'ai' ? 'AI 已整理' : '本地规则草稿'}
                </h2>
                <div className="mt-4 space-y-2">
                  {generatedDraft.steamInsights.map((item) => (
                    <div key={`${item.key}-${item.label}`} className="rounded-md bg-background/72 px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.evidence}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="surface-subtle p-4">
              <p className="text-sm font-semibold tracking-tight">审核提示</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                图片、说明和参考项目会一起进入审核。公开且通过审核后，作品会展示在挑战作品墙。
              </p>
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}
