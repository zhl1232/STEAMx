/** Read the actual request stream before invoking a JSON/multipart parser. */
export class BodyReadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'BodyReadError'
  }
}

export async function readBoundedBody(request: Request, maxBytes: number, timeoutMs = 15_000): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('Invalid body read limit')
  }
  const advertised = request.headers.get('content-length')
  if (advertised != null && /^\d+$/.test(advertised) && Number(advertised) > maxBytes) {
    throw new BodyReadError(413, '请求内容过大，请缩短后重试。')
  }
  if (request.signal.aborted) throw new BodyReadError(499, '请求已取消。')
  if (!request.body) throw new BodyReadError(400, '请求内容为空。')
  const reader = request.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectStop!: (error: Error) => void
  const stopped = new Promise<never>((_, reject) => { rejectStop = reject })
  const abort = () => rejectStop(new BodyReadError(499, '请求已取消。'))
  request.signal.addEventListener('abort', abort, { once: true })
  if (request.signal.aborted) abort()
  timer = setTimeout(() => rejectStop(new BodyReadError(408, '上传超时，请重试。')), timeoutMs)
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      if (request.signal.aborted) throw new BodyReadError(499, '请求已取消。')
      const { done, value } = await Promise.race([reader.read(), stopped])
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new BodyReadError(413, '请求内容过大，请缩短后重试。')
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes
  } catch (error) {
    // Do not wait indefinitely for an untrusted source's cancel implementation.
    void reader.cancel().catch(() => undefined)
    throw error
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new BodyReadError(415, '请使用 JSON 请求。')
  }
  const bytes = await readBoundedBody(request, maxBytes)
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { throw new BodyReadError(400, '请求体必须是有效 JSON。') }
}

export async function readBoundedForm(request: Request, maxBytes: number): Promise<FormData> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new BodyReadError(415, '请使用音频上传格式。')
  }
  const bytes = await readBoundedBody(request, maxBytes)
  try {
    // An owned ArrayBuffer avoids the SharedArrayBuffer/BodyInit type ambiguity.
    const body = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(body).set(bytes)
    return await new Response(body, { headers: { 'content-type': contentType } }).formData()
  } catch { throw new BodyReadError(400, '音频上传格式不正确。') }
}
