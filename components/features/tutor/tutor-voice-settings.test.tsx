import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TutorVoiceSettings } from './tutor-voice-settings'
import { TUTOR_VOICES } from '@/lib/ai/tutor/voice-catalog'
afterEach(() => vi.unstubAllGlobals())
it('offers both genders to members, previews without saving, and persists only on confirmation', async () => {
  const preview = vi.fn(), stop = vi.fn()
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ canChoose: true, voice: TUTOR_VOICES[0].id, voices: TUTOR_VOICES }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ canChoose: true, voice: 'anmingyuan_v3.1', voices: TUTOR_VOICES }) })
  vi.stubGlobal('fetch', fetch)
  render(<TutorVoiceSettings userId="one" onClose={vi.fn()} onPreview={preview} onStop={stop} />)
  const select = await screen.findByLabelText('选择声音')
  expect(screen.getAllByRole('option')).toHaveLength(7)
  fireEvent.change(select, { target: { value: 'anmingyuan_v3.1' } })
  fireEvent.click(screen.getByText('试听'))
  expect(preview).toHaveBeenCalledWith(expect.any(String), 'preview:anmingyuan_v3.1', 'anmingyuan_v3.1')
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(async () => fireEvent.click(screen.getByText('使用这个声音')))
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ voice: 'anmingyuan_v3.1' })
  await waitFor(() => expect(screen.getByText('已使用')).toBeTruthy())
})
it('does not expose voice selection controls to nonmembers', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ canChoose: false, voice: TUTOR_VOICES[0].id, voices: TUTOR_VOICES }) }))
  render(<TutorVoiceSettings userId="free" onClose={vi.fn()} onPreview={vi.fn()} onStop={vi.fn()} />)
  await screen.findByText(/会员可以试听并选择男声或女声/)
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByText('试听')).toBeNull()
})
