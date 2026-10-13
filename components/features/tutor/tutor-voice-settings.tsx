'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_TUTOR_VOICE, type TUTOR_VOICES } from '@/lib/ai/tutor/voice-catalog'

export function TutorVoiceSettings({ userId, onClose, onPreview, onStop }: {
  userId: string; onClose: () => void; onStop: () => void
  onPreview: (text: string, key: string, voice?: string) => Promise<void>
}) {
  const [access, setAccess] = useState<{ voice: string; canChoose: boolean; voices: typeof TUTOR_VOICES; expiresAt?: string | null } | null>(null)
  const [selected, setSelected] = useState<string>(DEFAULT_TUTOR_VOICE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/tutor/speech/voices', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error('暂时无法加载声音'); return response.json() })
      .then((value) => { if (!controller.signal.aborted) { setAccess(value); setSelected(value.voice) } })
      .catch(() => { if (!controller.signal.aborted) setError('暂时无法加载声音，请稍后重试。') })
    return () => { controller.abort(); onStop() }
  }, [userId, onStop])
  useEffect(() => {
    if (!access?.canChoose || !access.expiresAt) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = () => {
      const remaining = Date.parse(access.expiresAt!) - Date.now()
      if (remaining <= 0) {
        onStop()
        setAccess((current) => current ? { ...current, canChoose: false, voice: DEFAULT_TUTOR_VOICE } : current)
        setSelected(DEFAULT_TUTOR_VOICE)
        window.dispatchEvent(new Event('tutor-voice-selection-changed'))
      } else if (Number.isFinite(remaining)) timer = setTimeout(check, Math.min(remaining, 2_147_483_647))
    }
    check()
    return () => { if (timer) clearTimeout(timer) }
  }, [access?.canChoose, access?.expiresAt, onStop])
  const save = async () => {
    if (saving || !access?.canChoose) return
    setSaving(true); setError(''); onStop()
    try {
      const response = await fetch('/api/tutor/speech/voices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: selected }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '保存失败')
      setAccess(value)
      window.dispatchEvent(new Event('tutor-voice-selection-changed'))
    } catch (error) { setError(error instanceof Error ? error.message : '保存失败，请重试。') }
    finally { setSaving(false) }
  }
  return <section aria-label="朗读声音设置" className="border-b p-3 space-y-2 text-sm">
    <div className="flex items-center justify-between"><strong>朗读声音</strong><button type="button" className="min-h-11 px-3" onClick={onClose}>关闭</button></div>
    {!access && !error ? <p role="status">正在加载声音…</p> : null}
    {access?.canChoose ? <>
      <label className="block" htmlFor="tutor-voice-select">选择声音</label>
      <select id="tutor-voice-select" className="min-h-11 w-full rounded border bg-background px-2" value={selected} disabled={saving}
        onChange={(event) => { onStop(); setSelected(event.target.value) }}>
        {access.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.description}</option>)}
      </select>
      <div className="flex gap-2">
        <button type="button" className="min-h-11 px-3 rounded border" disabled={saving} onClick={() => void onPreview('你好，我是小迪。我们一起动手试试看吧！', `preview:${selected}`, selected)}>试听</button>
        <button type="button" className="min-h-11 px-3 rounded border" onClick={onStop}>停止</button>
        <button type="button" className="min-h-11 px-3 rounded bg-primary text-primary-foreground" disabled={saving || selected === access.voice} onClick={() => void save()}>{saving ? '保存中…' : selected === access.voice ? '已使用' : '使用这个声音'}</button>
      </div>
    </> : access ? <p>默认使用轻快自然的女声。会员可以试听并选择男声或女声。</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
