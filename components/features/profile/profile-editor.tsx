'use client'

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2, RefreshCcw, Save } from 'lucide-react'

import { AvatarUpload } from './avatar-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useProfileEditor } from '@/hooks/profile/use-profile-editor'
import { PROFILE_BIRTH_YEAR_OPTIONS, PROFILE_GENDER_OPTIONS, type ProfileSettingsUpdateInput } from '@/lib/profile/settings'
import { cn } from '@/lib/utils'

export type ProfileEditorTarget = 'overview' | 'avatar' | 'display_name'
export interface ProfileEditorHandle {
  requestLeave: (action?: () => void) => void
}
interface ProfileEditorProps {
  active?: boolean
  initialTarget?: ProfileEditorTarget
  mode?: 'dialog' | 'page'
  onSaved?: () => void
  onCancel?: () => void
  /** 「公开资料」标题右侧的操作（如预览公开主页）；不传时显示说明文字 */
  publicHeadingAction?: ReactNode
}

export const ProfileEditor = forwardRef<ProfileEditorHandle, ProfileEditorProps>(function ProfileEditor({
  active = true,
  initialTarget = 'overview',
  mode = 'page',
  onSaved,
  onCancel,
  publicHeadingAction,
}, ref) {
  const editor = useProfileEditor(active)
  const router = useRouter()
  const id = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const targetedRef = useRef(false)
  const [avatarExpanded, setAvatarExpanded] = useState(initialTarget === 'avatar')
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const busy = editor.saveStage !== null
  const frozen = busy || pendingLeave !== null
  const { form, fieldErrors, updateField } = editor
  const savedTitle = editor.original.equipped_title

  const focusField = (field: keyof ProfileSettingsUpdateInput) => {
    const element = formRef.current?.querySelector<HTMLElement>(`[data-profile-field="${field}"]`)
    element?.focus({ preventScroll: true })
    element?.scrollIntoView?.({ block: 'nearest' })
  }

  const requestLeave = (action = onCancel ?? (() => {})) => {
    if (editor.isSaving()) return
    if (!editor.dirty) {
      action()
      return
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPendingLeave(() => action)
  }
  useImperativeHandle(ref, () => ({ requestLeave }))

  useEffect(() => {
    if (!active || editor.phase !== 'ready' || targetedRef.current) return
    targetedRef.current = true
    if (initialTarget === 'display_name') focusField('display_name')
    if (initialTarget === 'avatar') focusField('avatar_url')
  }, [active, editor.phase, initialTarget])

  useEffect(() => {
    if (pendingLeave) continueRef.current?.focus()
  }, [pendingLeave])

  useEffect(() => {
    if (!active || mode !== 'page' || editor.phase !== 'ready' || !window.visualViewport) return
    const viewport = window.visualViewport
    const syncFooter = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      footerRef.current?.style.setProperty('--profile-keyboard-offset', `${offset}px`)
    }
    syncFooter()
    viewport.addEventListener('resize', syncFooter)
    viewport.addEventListener('scroll', syncFooter)
    return () => {
      viewport.removeEventListener('resize', syncFooter)
      viewport.removeEventListener('scroll', syncFooter)
    }
  }, [active, mode, editor.phase])

  const fieldProps = (field: keyof ProfileSettingsUpdateInput) => ({
    id: `${id}-${field}`,
    'data-profile-field': field,
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `${id}-${field}-error` : undefined,
  })
  const fieldError = (field: keyof ProfileSettingsUpdateInput) => fieldErrors[field] ? (
    <p id={`${id}-${field}-error`} className="text-sm text-destructive" role="alert">{fieldErrors[field]}</p>
  ) : null

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pendingLeave) return
    const result = await editor.save()
    if (result.kind === 'invalid') focusField(result.field)
    if (result.kind === 'saved') onSaved?.()
  }

  if (editor.phase === 'loading') {
    return (
      <div role="status" className="space-y-6 p-6">
        <span className="sr-only">加载个人资料中</span>
        <Skeleton className="mx-auto h-24 w-24 rounded-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }
  if (editor.phase === 'error') {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-destructive" role="alert">{editor.loadError}</p>
        <Button type="button" className="mt-4 min-h-11" variant="secondary" onClick={editor.retry}>
          <RefreshCcw className="mr-2 h-4 w-4" />重试
        </Button>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      aria-busy={busy}
      className={cn('flex min-h-0 flex-1 flex-col', mode === 'page' && 'pb-24 md:pb-0')}
    >
      <div className={cn('min-h-0 px-4 py-5 md:p-6', mode === 'dialog' && 'flex-1 overflow-y-auto overscroll-contain')}>
        <div className="grid gap-7 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
          <div className="min-w-0 space-y-3">
            <AvatarUpload
              value={form.avatar_url}
              persistedUploadUrl={editor.persistedUploadUrl}
              pendingUploadUrl={editor.pendingAvatar?.previewUrl}
              onFileSelect={editor.chooseFile}
              onDefaultSelect={url => updateField('avatar_url', url)}
              expanded={avatarExpanded}
              onExpandedChange={setAvatarExpanded}
              disabled={frozen}
              showCameraBadge
              priority
            />
            <p className="break-all text-center text-xs leading-5 text-muted-foreground">账号 ID：{editor.username || '未设置'}</p>
            {fieldError('avatar_url')}
          </div>

          <div className="min-w-0 space-y-7">
            <section className="space-y-4" aria-labelledby={`${id}-public-heading`}>
              <div className="flex items-center justify-between gap-3">
                <h2 id={`${id}-public-heading`} className="text-base font-semibold">公开资料</h2>
                {publicHeadingAction ?? <span className="text-xs text-muted-foreground">展示在个人主页</span>}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${id}-display_name`}>昵称</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{form.display_name.length}/30</span>
                </div>
                <Input {...fieldProps('display_name')} name="display_name" value={form.display_name} maxLength={30}
                  onChange={event => updateField('display_name', event.target.value)} disabled={frozen}
                  placeholder="你希望大家怎么称呼你" className="h-11 text-base" />
                {fieldError('display_name')}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${id}-bio`}>简介</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{form.bio.length}/30</span>
                </div>
                <Textarea {...fieldProps('bio')} name="bio" value={form.bio} maxLength={30} rows={3}
                  onChange={event => updateField('bio', event.target.value)} disabled={frozen}
                  placeholder="说说你的兴趣，或最近在探索什么" className="min-h-24 resize-none text-base" />
                {fieldError('bio')}
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-equipped_title`}>主页称号</Label>
                <Select value={form.equipped_title ?? 'auto'} disabled={frozen}
                  onValueChange={value => updateField('equipped_title', value === 'auto' ? null : value)}>
                  <SelectTrigger {...fieldProps('equipped_title')} className="h-11 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">系统自动推荐</SelectItem>
                    <SelectItem value="none">隐藏称号</SelectItem>
                    {savedTitle && savedTitle !== 'none' && savedTitle !== 'auto' ? (
                      <SelectItem value={savedTitle}>{savedTitle}（当前佩戴）</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-muted-foreground">自动推荐会根据你的成就选择称号。</p>
                {fieldError('equipped_title')}
              </div>
            </section>

            <section className="space-y-4 border-t border-border/60 pt-5" aria-labelledby={`${id}-optional-heading`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`${id}-optional-heading`} className="text-base font-semibold">补充资料</h2>
                <span className="text-xs text-muted-foreground">选填</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-gender`}>性别</Label>
                <Select value={form.gender || 'unset'} disabled={frozen}
                  onValueChange={value => updateField('gender', value === 'unset' ? null : value as typeof PROFILE_GENDER_OPTIONS[number])}>
                  <SelectTrigger {...fieldProps('gender')} className="h-11 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">不设置</SelectItem>
                    {PROFILE_GENDER_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldError('gender')}
              </div>
              <fieldset className="min-w-0 space-y-2">
                <legend className="sr-only">出生年月</legend>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${id}-birth_year`}>出生年月</Label>
                  <Button type="button" variant="ghost" className="h-11 px-3 text-xs text-muted-foreground"
                    disabled={frozen || (!form.birth_year && !form.birth_month)}
                    onClick={() => { updateField('birth_year', null); updateField('birth_month', null) }}>清空</Button>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <Select value={form.birth_year || 'unset'} disabled={frozen}
                    onValueChange={value => updateField('birth_year', value === 'unset' ? null : value)}>
                    <SelectTrigger {...fieldProps('birth_year')} aria-label="出生年份" className="h-11 min-w-0 text-base"><SelectValue placeholder="年" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">年份（选填）</SelectItem>
                      {PROFILE_BIRTH_YEAR_OPTIONS.map(year => <SelectItem key={year} value={year}>{year} 年</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.birth_month || 'unset'} disabled={frozen}
                    onValueChange={value => updateField('birth_month', value === 'unset' ? null : value)}>
                    <SelectTrigger {...fieldProps('birth_month')} aria-label="出生月份" className="h-11 min-w-0 text-base"><SelectValue placeholder="月" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">月份（选填）</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(month => <SelectItem key={month} value={month}>{month} 月</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {fieldError('birth_year')}
                {fieldError('birth_month')}
                <p className="text-xs leading-5 text-muted-foreground">性别与出生年月不会显示在公开主页。</p>
              </fieldset>
            </section>
            <Link href="/settings/security"
              onClick={event => { event.preventDefault(); requestLeave(() => router.push('/settings/security')) }}
              aria-disabled={busy || undefined}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              手机号等账号安全设置<ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div ref={footerRef} className={cn(
        'shrink-0 border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6',
        mode === 'page' && 'fixed inset-x-0 bottom-[var(--profile-keyboard-offset,0px)] z-30 md:sticky md:inset-x-auto md:bottom-0',
      )}>
        {pendingLeave ? (
          <div role="alertdialog" aria-labelledby={`${id}-discard-title`} aria-describedby={`${id}-discard-description`}>
            <p id={`${id}-discard-title`} className="text-sm font-semibold">放弃本次修改？</p>
            <p id={`${id}-discard-description`} className="mt-1 text-xs text-muted-foreground">未保存的内容会丢失。</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button ref={continueRef} type="button" variant="secondary" className="min-h-11"
                onClick={() => { setPendingLeave(null); requestAnimationFrame(() => returnFocusRef.current?.focus()) }}>继续编辑</Button>
              <Button type="button" variant="destructive" className="min-h-11"
                onClick={() => { const action = pendingLeave; setPendingLeave(null); action() }}>放弃修改</Button>
            </div>
          </div>
        ) : (
          <>
            {editor.saveError ? <p className="mb-3 text-sm text-destructive" role="alert">{editor.saveError}</p> : null}
            <div className="flex items-center justify-end gap-3">
              <p className="mr-auto hidden text-xs text-muted-foreground md:block" role="status">
                {busy ? (editor.saveStage === 'uploading' ? '正在处理头像…' : '正在保存…') : editor.dirty ? '有未保存的修改' : '修改会同步到个人主页'}
              </p>
              <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={() => requestLeave()}>取消</Button>
              <Button type="submit" className="h-11 flex-1 px-6 md:flex-none" disabled={busy || !editor.dirty}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {busy ? '保存中…' : '保存更改'}
              </Button>
            </div>
          </>
        )}
      </div>
    </form>
  )
})
