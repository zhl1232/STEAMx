/** Beijing Mandarin voices; descriptions are vendor labels, not listening-test results. */
export const TUTOR_VOICES = [
  { id: 'yezhiqing_v3.1', name: '叶知晴', description: '女声 · 轻快自然' },
  { id: 'yuxiaoyun_v3.1', name: '于小云', description: '女声 · 活力亲切' },
  { id: 'xuxiaoqiao_v3.1', name: '徐小俏', description: '女声 · 自然俏皮' },
  { id: 'wenhuaiqing_v3.1', name: '温怀清', description: '女声 · 清亮柔和' },
  { id: 'anmingyuan_v3.1', name: '安明远', description: '男声 · 清亮自然' },
  { id: 'longanyang_v3.1', name: '龙安洋', description: '男声 · 阳光' },
  { id: 'longsanshu_v3.1', name: '龙三叔', description: '男声 · 沉稳' },
] as const
export const DEFAULT_TUTOR_VOICE = TUTOR_VOICES[0].id
export function isTutorVoice(value: unknown): value is typeof TUTOR_VOICES[number]['id'] {
  return TUTOR_VOICES.some((voice) => voice.id === value)
}
