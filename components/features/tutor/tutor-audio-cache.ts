/** In-memory, per-hook cache. Never store audio in shared localStorage or on a public server. */
export function pcmWav(chunks: ArrayBuffer[], sampleRate = 24000) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + size, true); text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, size, true)
  return new Blob([header, ...chunks], { type: 'audio/wav' })
}

export class TutorAudioCache {
  private entries = new Map<string, { blob: Blob; expires: number }>()
  clear() { this.entries.clear() }
  get(key: string) {
    const item = this.entries.get(key)
    if (!item || item.expires <= Date.now()) { this.entries.delete(key); return null }
    return item.blob
  }
  put(key: string, blob: Blob) {
    if (blob.size > 8 * 1024 * 1024) return
    this.entries.delete(key)
    this.entries.set(key, { blob, expires: Date.now() + 10 * 60_000 })
    while (this.entries.size > 8 || [...this.entries.values()].reduce((sum, item) => sum + item.blob.size, 0) > 16 * 1024 * 1024) {
      this.entries.delete(this.entries.keys().next().value!)
    }
  }
}
