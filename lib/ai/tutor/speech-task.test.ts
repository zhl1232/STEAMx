import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
type Frame = { header: { action: string; task_id: string }; payload: { input?: unknown; model?: string } }
type Socket = EventEmitter & { url: string; sent: Frame[]; close: ReturnType<typeof vi.fn> }
const mocks = vi.hoisted(() => ({ sockets: [] as Socket[], reserve: vi.fn() }))
vi.mock('./speech-budget', () => ({ reserveSpeechRequest: mocks.reserve }))
vi.mock('ws', () => ({ default: class extends EventEmitter {
  static OPEN = 1
  static CONNECTING = 0
  readyState = 1
  sent: Frame[] = []
  close = vi.fn()
  terminate = vi.fn()
  constructor(public url: string) { super(); mocks.sockets.push(this) }
  send(value: string | Buffer) { this.sent.push(typeof value === 'string' ? JSON.parse(value) as Frame : value as unknown as Frame) }
} }))
import { createTaskTtsSession, transcribeTaskPcm, speechTaskUrl, TTS_MODEL, ASR_MODEL } from './speech-task'
import { createTutorRealtimeTtsSession, transcribeTutorSpeechPcm16 } from './speech'

beforeEach(() => {
  vi.stubEnv('DASHSCOPE_API_KEY', 'test-only')
  vi.stubEnv('DASHSCOPE_WORKSPACE_ID', 'test-workspace')
  vi.stubEnv('DASHSCOPE_TUTOR_AUDIO_WS_URL', '')
  vi.stubEnv('DASHSCOPE_TUTOR_AUDIO_PROTOCOL', '')
  for (const key of ['DASHSCOPE_BASE_URL', 'DASHSCOPE_TUTOR_TTS_URL', 'DASHSCOPE_TUTOR_TTS_WS_URL', 'DASHSCOPE_TUTOR_ASR_WS_URL']) vi.stubEnv(key, '')
  mocks.reserve.mockResolvedValue(undefined)
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks(); mocks.sockets.length = 0 })
async function socket() { await Promise.resolve(); const ws = mocks.sockets.at(-1)!; ws.emit('open'); return ws }
function event(ws: Socket, name: string, payload = {}, id = ws.sent[0].header.task_id) {
  ws.emit('message', Buffer.from(JSON.stringify({ header: { task_id: id, event: name }, payload })), false)
}
describe('Qwen Audio 3.1 task protocol', () => {
  it('waits for task-started, keeps one UUID, sends finish and delivers binary PCM', async () => {
    const onAudio = vi.fn()
    const session = createTaskTtsSession({ onAudio, voice: 'anmingyuan_v3.1' })
    session.append('你好。')
    const ws = await socket()
    expect(ws.url).toBe('wss://test-workspace.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference')
    expect(ws.sent).toHaveLength(1)
    expect(ws.sent[0].payload).toMatchObject({ model: TTS_MODEL, task: 'tts', parameters: { voice: 'anmingyuan_v3.1', format: 'pcm' } })
    event(ws, 'task-started', {}, 'wrong-task')
    expect(ws.sent).toHaveLength(1)
    event(ws, 'task-started')
    await session.ready
    const completed = session.finish()
    await Promise.resolve()
    expect(ws.sent.map((value: Frame) => value.header.action)).toEqual(['run-task', 'continue-task', 'finish-task'])
    expect(new Set(ws.sent.map((value: Frame) => value.header.task_id)).size).toBe(1)
    ws.emit('message', Buffer.from([0, 1]), true)
    expect(onAudio).toHaveBeenCalledWith(Buffer.from([0, 1]))
    event(ws, 'task-finished')
    await completed
    expect(ws.close).toHaveBeenCalled()
  })
  it('defaults to the new protocol even when old model variables and auto-switch exist', async () => {
    vi.stubEnv('DASHSCOPE_TUTOR_TTS_REALTIME_MODEL', 'qwen3-tts-flash-realtime')
    vi.stubEnv('DASHSCOPE_MODEL_AUTO_SWITCH', 'true')
    const session = createTutorRealtimeTtsSession({ onAudio: vi.fn() })
    const ws = await socket()
    expect(ws.sent[0].payload.model).toBe(TTS_MODEL)
    session.abort()
    await expect(session.ready).rejects.toMatchObject({ status: 499 })
  })
  it('sends ASR binary frames after readiness and merges only finalized, deduplicated sentences', async () => {
    const promise = transcribeTutorSpeechPcm16(new ArrayBuffer(6400), { courseControl: true })
    const ws = await socket()
    expect(ws.sent[0].payload).toMatchObject({ model: ASR_MODEL, parameters: { vocabulary: { '下一步': 3 } } })
    event(ws, 'task-started')
    await Promise.resolve()
    expect(Buffer.isBuffer(ws.sent[1])).toBe(true)
    expect(ws.sent[1]).toHaveLength(3200)
    const result = (sentence_id: number, text: string, sentence_end: boolean) => event(ws, 'result-generated', { output: { sentence: { sentence_id, text, sentence_end } } })
    result(1, '下', false); result(2, '暂停。', true); result(1, '下一步。', true); result(1, '下一步。', true)
    event(ws, 'task-finished')
    await expect(promise).resolves.toBe('下一步。暂停。')
  })
  it('does not open a socket for an already cancelled request', async () => {
    const controller = new AbortController(); controller.abort()
    const session = createTaskTtsSession({ signal: controller.signal, onAudio: vi.fn() })
    await expect(session.ready).rejects.toMatchObject({ status: 499 })
    expect(mocks.sockets).toHaveLength(0)
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
  it('cancels TTS by directive and ignores audio arriving after cancellation', async () => {
    const onAudio = vi.fn(), controller = new AbortController()
    const session = createTaskTtsSession({ onAudio, signal: controller.signal })
    const ws = await socket(); event(ws, 'task-started'); await session.ready
    controller.abort()
    expect(ws.sent.at(-1)!.payload.input).toEqual({ directive: 'cancel' })
    ws.emit('message', Buffer.from([0, 1]), true)
    expect(onAudio).not.toHaveBeenCalled()
    await expect(session.finish()).rejects.toMatchObject({ status: 499 })
  })
  it('surfaces 429 without opening a second connection or retrying', async () => {
    const session = createTaskTtsSession({ onAudio: vi.fn() })
    const ws = await socket()
    ws.emit('unexpected-response', {}, { statusCode: 429, resume: vi.fn() })
    await expect(session.ready).rejects.toMatchObject({ status: 429 })
    expect(mocks.sockets).toHaveLength(1)
  })
  it('fails closed when the shared budget cannot admit a request', async () => {
    mocks.reserve.mockRejectedValueOnce(new Error('budget unavailable'))
    const session = createTaskTtsSession({ onAudio: vi.fn() })
    await expect(session.ready).rejects.toThrow('budget unavailable')
    expect(mocks.sockets).toHaveLength(0)
  })
  it('rejects truncated connections and handshake timeouts', async () => {
    vi.useFakeTimers()
    const session = createTaskTtsSession({ onAudio: vi.fn() })
    await socket()
    await vi.advanceTimersByTimeAsync(10001)
    await expect(session.ready).rejects.toMatchObject({ status: 504 })
    const next = createTaskTtsSession({ onAudio: vi.fn() })
    const ws = await socket(); ws.emit('close')
    await expect(next.ready).rejects.toMatchObject({ status: 502 })
  })
  it('does not accept interim ASR text as a completed command', async () => {
    const promise = transcribeTaskPcm(new ArrayBuffer(4))
    const ws = await socket(); event(ws, 'task-started'); await Promise.resolve()
    event(ws, 'result-generated', { output: { sentence: { sentence_id: 1, text: '下一步', sentence_end: false } } })
    event(ws, 'task-finished')
    await expect(promise).rejects.toMatchObject({ status: 400 })
  })
  it('aborts ASR before processing late finalized commands', async () => {
    const controller = new AbortController()
    const promise = transcribeTaskPcm(new ArrayBuffer(4), controller.signal)
    const ws = await socket(); event(ws, 'task-started'); await Promise.resolve()
    controller.abort()
    event(ws, 'result-generated', { output: { sentence: { sentence_id: 1, text: '下一步', sentence_end: true } } })
    event(ws, 'task-finished')
    await expect(promise).rejects.toMatchObject({ status: 499 })
    expect(ws.close).toHaveBeenCalledOnce()
  })
  it('retains the existing Beijing default and new task model without requiring a Workspace ID', async () => {
    vi.stubEnv('DASHSCOPE_WORKSPACE_ID', '')
    expect(speechTaskUrl()).toBe('wss://dashscope.aliyuncs.com/api-ws/v1/inference')
    const session = createTaskTtsSession({ onAudio: vi.fn() })
    const ws = await socket()
    expect(ws.sent[0]).toMatchObject({ header: { action: 'run-task' }, payload: { model: TTS_MODEL } })
    session.abort()
    await expect(session.ready).rejects.toMatchObject({ status: 499 })
  })
  it('rejects wrong regions and unknown voices before any call', () => {
    vi.stubEnv('DASHSCOPE_WORKSPACE_ID', '')
    vi.stubEnv('DASHSCOPE_TUTOR_AUDIO_WS_URL', 'wss://example.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/inference')
    expect(speechTaskUrl).toThrow('Invalid Beijing')
    expect(() => createTaskTtsSession({ onAudio: vi.fn(), voice: 'Ethan' })).toThrow('Unsupported voice')
  })
  it('accepts official ws-prefixed workspace hosts and prioritizes them over the old Beijing host', () => {
    vi.stubEnv('DASHSCOPE_WORKSPACE_ID', 'ws-example123')
    vi.stubEnv('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    expect(speechTaskUrl()).toBe('wss://ws-example123.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference')
    vi.stubEnv('DASHSCOPE_WORKSPACE_ID', '')
    vi.stubEnv('DASHSCOPE_TUTOR_AUDIO_WS_URL', 'wss://ws-example123.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference')
    expect(speechTaskUrl()).toBe('wss://ws-example123.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference')
  })
  it('prefers an existing dedicated API Host and translates old realtime paths', () => {
    vi.stubEnv('DASHSCOPE_WORKSPACE_ID', '')
    vi.stubEnv('DASHSCOPE_TUTOR_ASR_WS_URL', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime')
    vi.stubEnv('DASHSCOPE_BASE_URL', 'https://llm-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1')
    expect(speechTaskUrl()).toBe('wss://llm-example.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference')
    vi.stubEnv('DASHSCOPE_BASE_URL', '')
    vi.stubEnv('DASHSCOPE_TUTOR_ASR_WS_URL', 'wss://llm-old.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime')
    expect(speechTaskUrl()).toBe('wss://llm-old.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference')
  })
  it.each([
    'wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime',
    'wss://dashscope.aliyuncs.com.evil.example/api-ws/v1/realtime',
    'ws://dashscope.aliyuncs.com/api-ws/v1/realtime',
    'wss://user:password@dashscope.aliyuncs.com/api-ws/v1/realtime',
    'wss://trial.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime',
    'wss://dashscope.aliyuncs.com:8443/api-ws/v1/realtime',
  ])('does not reinterpret unsafe or non-Beijing legacy config: %s', (url) => {
    vi.stubEnv('DASHSCOPE_WORKSPACE_ID', '')
    vi.stubEnv('DASHSCOPE_TUTOR_ASR_WS_URL', url)
    expect(speechTaskUrl).toThrow('Invalid Beijing audio endpoint')
  })
})
