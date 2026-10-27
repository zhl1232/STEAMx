'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { logger } from '@/lib/logger'
import { ProfileSettingsUpdateSchema, PROFILE_SETTINGS_DEFAULTS, type ProfileSettingsUpdateInput } from '@/lib/profile/settings'
import { compressImageForBucket } from '@/lib/utils/image-compression'

type ProfilePayload = ProfileSettingsUpdateInput & {
  username: string | null
  last_uploaded_avatar_url: string | null
}
type Field = keyof ProfileSettingsUpdateInput
type PendingAvatar = { file: File; previewUrl: string; uploadedUrl?: string }
type SaveResult = { kind: 'saved' | 'ignored' | 'failed' } | { kind: 'invalid'; field: Field }

function toForm(profile: ProfilePayload): ProfileSettingsUpdateInput {
  return {
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    gender: profile.gender ?? null,
    birth_year: profile.birth_year ?? null,
    birth_month: profile.birth_month ?? null,
    avatar_url: profile.avatar_url || PROFILE_SETTINGS_DEFAULTS.avatar_url,
    equipped_title: profile.equipped_title ?? null,
  }
}

export function useProfileEditor(active = true) {
  const { user, refreshProfile } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = useState<ProfileSettingsUpdateInput>(PROFILE_SETTINGS_DEFAULTS)
  const [original, setOriginal] = useState<ProfileSettingsUpdateInput>(PROFILE_SETTINGS_DEFAULTS)
  const [username, setUsername] = useState<string | null>(null)
  const [persistedUploadUrl, setPersistedUploadUrl] = useState('')
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const [saveStage, setSaveStage] = useState<'uploading' | 'saving' | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const objectUrlRef = useRef<string | null>(null)
  const savingRef = useRef(false)
  const sessionRef = useRef(0)
  const dirty = phase === 'ready' && JSON.stringify(form) !== JSON.stringify(original)

  const clearPreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const session = ++sessionRef.current
    savingRef.current = false
    // Loading synchronizes a new external request, including account changes and retries.
    // oxlint-disable-next-line react/set-state-in-effect
    setSaveStage(null)
    setPhase('loading')
    setLoadError('')
    setSaveError('')
    setFieldErrors({})

    void (async () => {
      try {
        const response = await fetch('/api/settings/profile', {
          credentials: 'same-origin',
          signal: controller.signal,
        })
        const data = await response.json().catch(() => null)
        if (controller.signal.aborted) return
        if (response.status === 401) throw new Error('登录已失效，请重新登录')
        if (!response.ok || !data?.profile) throw new Error('加载失败，请重试')
        const profile = data.profile as ProfilePayload
        const next = toForm(profile)
        clearPreview()
        setPendingAvatar(null)
        setUsername(profile.username)
        setPersistedUploadUrl(profile.last_uploaded_avatar_url || (
          profile.avatar_url && !profile.avatar_url.startsWith('/avatars/') ? profile.avatar_url : ''
        ))
        setForm(next)
        setOriginal(next)
        setPhase('ready')
      } catch (error) {
        if (controller.signal.aborted) return
        logger.error(error, { context: 'load profile editor' })
        setLoadError(error instanceof Error && error.message === '登录已失效，请重新登录' ? error.message : '加载失败，请重试')
        setPhase('error')
      }
    })()

    return () => {
      controller.abort()
      if (sessionRef.current === session) sessionRef.current += 1
      clearPreview()
    }
  }, [active, user?.id, loadAttempt, clearPreview])

  useEffect(() => {
    if (!active || (!dirty && !saveStage)) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [active, dirty, saveStage])

  const updateField = <K extends Field>(key: K, value: ProfileSettingsUpdateInput[K]) => {
    if (savingRef.current) return
    setForm(current => ({ ...current, [key]: value }))
    setFieldErrors(current => ({
      ...current,
      [key]: undefined,
      ...(key === 'birth_year' || key === 'birth_month' ? { birth_year: undefined, birth_month: undefined } : {}),
    }))
    setSaveError('')
  }

  const chooseFile = (file: File) => {
    if (savingRef.current) return
    clearPreview()
    const previewUrl = URL.createObjectURL(file)
    objectUrlRef.current = previewUrl
    setPendingAvatar({ file, previewUrl })
    updateField('avatar_url', previewUrl)
  }

  const save = async (): Promise<SaveResult> => {
    if (savingRef.current || phase !== 'ready' || !dirty) return { kind: 'ignored' }
    const parsed = ProfileSettingsUpdateSchema.safeParse(form)
    if (!parsed.success) {
      const errors: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field
        errors[field] ??= issue.message
      }
      setFieldErrors(errors)
      return { kind: 'invalid', field: parsed.error.issues[0].path[0] as Field }
    }

    const session = sessionRef.current
    const isCurrent = () => sessionRef.current === session
    savingRef.current = true
    setSaveError('')
    setFieldErrors({})
    setSaveStage('saving')
    try {
      let avatarUrl = parsed.data.avatar_url
      if (pendingAvatar && avatarUrl === pendingAvatar.previewUrl) {
        if (pendingAvatar.uploadedUrl) {
          avatarUrl = pendingAvatar.uploadedUrl
        } else {
          setSaveStage('uploading')
          const prepared = await compressImageForBucket(pendingAvatar.file, 'avatars')
          if (!isCurrent()) return { kind: 'ignored' }
          const body = new FormData()
          body.append('file', prepared)
          body.append('bucket', 'avatars')
          const response = await fetch('/api/upload', { method: 'POST', body })
          const data = await response.json().catch(() => null)
          if (!isCurrent()) return { kind: 'ignored' }
          if (!response.ok || typeof data?.publicUrl !== 'string' || !data.publicUrl || /^(blob:|data:)/.test(data.publicUrl)) {
            throw new Error(data?.error || '头像上传失败，请重试')
          }
          avatarUrl = data.publicUrl
          // Keep the uploaded URL through a failed PATCH so retrying does not upload twice.
          setPendingAvatar({ ...pendingAvatar, uploadedUrl: avatarUrl })
        }
      }
      if (avatarUrl.startsWith('blob:')) throw new Error('请重新选择头像后保存')
      setSaveStage('saving')
      const response = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.data, avatar_url: avatarUrl }),
      })
      const data = await response.json().catch(() => null)
      if (!isCurrent()) return { kind: 'ignored' }
      if (!response.ok || !data?.profile) throw new Error(data?.error || '保存失败，请稍后重试')
      const profile = data.profile as ProfilePayload
      const next = toForm(profile)
      clearPreview()
      setPendingAvatar(null)
      setPersistedUploadUrl(profile.last_uploaded_avatar_url || '')
      setUsername(profile.username)
      setForm(next)
      setOriginal(next)

      // The PATCH succeeded: a later refresh failure must not be reported as a failed save.
      try {
        await refreshProfile()
        if (isCurrent()) router.refresh()
      } catch (error) {
        logger.warn('Profile saved but refresh failed', { error })
      }
      if (!isCurrent()) return { kind: 'ignored' }
      toast({ title: '资料已保存' })
      return { kind: 'saved' }
    } catch (error) {
      if (isCurrent()) {
        logger.error(error, { context: 'save profile editor' })
        setSaveError(error instanceof Error ? error.message : '保存失败，请稍后重试')
      }
      return { kind: 'failed' }
    } finally {
      if (isCurrent()) {
        savingRef.current = false
        setSaveStage(null)
      }
    }
  }

  return {
    form, original, username, persistedUploadUrl, pendingAvatar,
    phase, loadError, saveError, fieldErrors, saveStage, dirty,
    isSaving: () => savingRef.current,
    retry: () => setLoadAttempt(attempt => attempt + 1),
    updateField, chooseFile, save,
  }
}
