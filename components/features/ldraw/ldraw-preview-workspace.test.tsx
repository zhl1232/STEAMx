import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Group, Scene, Vector3 } from 'three'
import type { LdrawModelInfo } from '@/lib/courses/ldraw-packer'
import { LdrawPreviewWorkspace } from './ldraw-preview-workspace'

const boundary = vi.hoisted(() => ({
  parse: vi.fn(),
  render: vi.fn(),
  rendererDispose: vi.fn(),
  controlsUpdate: vi.fn(),
  controlsDispose: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: boundary.toast }) }))
vi.mock('three', async (importOriginal) => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = document.createElement('canvas')
    setSize() {}
    setPixelRatio() {}
    render = boundary.render
    dispose = boundary.rendererDispose
  },
}))
vi.mock('three/examples/jsm/loaders/LDrawLoader.js', () => ({
  LDrawLoader: class {
    partsCache = { parseCache: { setData() {}, fetchData: vi.fn() } }
    setConditionalLineMaterial() {}
    addDefaultMaterials() {}
    async preloadMaterials() {}
    getMaterial() { return {} }
    parse = boundary.parse
  },
}))
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    target = new Vector3()
    update = boundary.controlsUpdate
    addEventListener() {}
    removeEventListener() {}
    dispose = boundary.controlsDispose
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function item(name: string, overrides: Partial<LdrawModelInfo> = {}): LdrawModelInfo {
  return {
    name, title: name.replace('.ldr', ''), hasMpd: false, sizeBytes: 100,
    updatedAt: '2026-10-23', category: '3+', reviewStatus: 'unconfirmed',
    legacyReviewStatus: 'pending', confirmedAt: null, inspectionStatus: 'checked',
    ...overrides,
  }
}

function model(name = 'first.ldr', overrides: Record<string, unknown> = {}) {
  return {
    modelName: name.replace('.ldr', ''),
    mpdText: `0 FILE ${name}\n0 ${name} model\n2 16 0 0 0 10 0 0\n`,
    stepCount: 1, partCount: 1, missingParts: [], revision: `${name}-revision`,
    reviewStatus: 'unconfirmed', inspectionStatus: 'checked', canConfirm: true,
    ...overrides,
  }
}

function json(data: unknown) { return new Response(JSON.stringify(data)) }

function mockApi(list: Promise<Response> | Response, previews: Record<string, Promise<Response> | Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PATCH') return Promise.resolve(json({ confirmedAt: '2026-10-23', reviewRecordCount: 1 }))
    const url = new URL(String(input), window.location.origin)
    const name = url.searchParams.get('model')
    if (!name) return Promise.resolve(list)
    if (!(name in previews)) throw new Error(`Unexpected model request: ${name}`)
    return Promise.resolve(previews[name])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/dev/ldraw-preview?model=first.ldr')
  boundary.parse.mockImplementation((_text: string, resolve: (group: Group) => void) => resolve(new Group()))
  // Frames remain controlled: the first model must be drawn directly before confirmation opens.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => { vi.unstubAllGlobals() })

describe('LDraw preview confirmation workflow', () => {
  it('excludes protected changed drafts from the ready queue while retaining them in changed and all', async () => {
    window.history.replaceState(null, '', '/ldraw-preview?model=first.ldr&source=draft')
    mockApi(json({ models: [item('first.ldr', { reviewStatus: 'confirmed', productionProtected: true })] }), {
      'first.ldr': json(model('first.ldr', {
        servedDraft: true, reviewStatus: 'changed', productionProtected: true, canConfirm: false,
      })),
    })
    render(<LdrawPreviewWorkspace />)
    await screen.findByText('当前查看修改稿 · 有改动待复核')

    expect(screen.getByRole('button', { name: '待确认 0' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /first\.ldr/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '有改动待复核 1' }))
    expect(screen.getByRole('button', { name: /first\.ldr.*有改动·待复核/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '审核状态 (1)' }))
    expect(screen.getByRole('button', { name: /first\.ldr.*有改动·待复核/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认当前修复' })).not.toBeInTheDocument()
  })

  it('preserves draft source on initial load, reload and model selection, and labels protected drafts', async () => {
    window.history.replaceState(null, '', '/ldraw-preview?model=first.ldr&source=draft')
    const draft = { servedDraft: true, reviewStatus: 'changed', productionProtected: true, canConfirm: false, inspectionStatus: 'exempt' }
    const fetchMock = mockApi(json({ models: [item('first.ldr'), item('next.ldr')] }), {
      'first.ldr': json(model('first.ldr', draft)), 'next.ldr': json(model('next.ldr', draft)),
    })
    render(<LdrawPreviewWorkspace />)
    await screen.findByText('当前查看修改稿 · 有改动待复核')
    expect(screen.queryByText('已确认（线上版本）')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认当前修复' })).not.toBeInTheDocument()

    // A fresh response is needed because each response body can only be consumed once.
    fetchMock.mockImplementation((input) => {
      const url = new URL(String(input), window.location.origin)
      return Promise.resolve(json(model(url.searchParams.get('model') ?? 'first.ldr', draft)))
    })
    fireEvent.click(screen.getByRole('button', { name: '重新载入文件' }))
    await waitFor(() => expect(boundary.parse).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: /next\.ldr.*待确认/ }))
    await waitFor(() => expect(boundary.parse).toHaveBeenCalledTimes(3))
    expect(new URL(window.location.href).searchParams.get('source')).toBe('draft')
    expect(new URL(window.location.href).searchParams.get('model')).toBe('next.ldr')
    const modelRequests = fetchMock.mock.calls.map(([input]) => new URL(String(input), window.location.origin)).filter((url) => url.searchParams.has('model'))
    expect(modelRequests).toHaveLength(3)
    expect(modelRequests.every((url) => url.searchParams.get('source') === 'draft')).toBe(true)
    expect(screen.getByText('当前查看修改稿 · 有改动待复核')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认当前修复' })).not.toBeInTheDocument()
  })

  it('shows checked candidates and changed models, and unlocks confirmation only after parsing and drawing', async () => {
    let finishParse!: (group: Group) => void
    boundary.parse.mockImplementation((_text: string, resolve: (group: Group) => void) => { finishParse = resolve })
    const fetchMock = mockApi(json({ models: [
      item('first.ldr'), item('changed.ldr', { reviewStatus: 'changed' }),
      item('unchecked.ldr', { inspectionStatus: 'unchecked' }),
      item('repair.ldr', { inspectionStatus: 'needs-repair' }),
      item('confirmed.ldr', { reviewStatus: 'confirmed' }),
    ] }), { 'first.ldr': json(model()) })
    render(<LdrawPreviewWorkspace />)

    await waitFor(() => expect(boundary.parse).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: '待确认 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /first\.ldr.*待确认/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /changed\.ldr.*待复核/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unchecked\.ldr|repair\.ldr|confirmed\.ldr/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认当前修复' })).not.toBeInTheDocument()
    expect(screen.getByText('正在载入 3D 模型...')).toBeInTheDocument()

    const group = new Group()
    let drewBeforeConfirmation = false
    boundary.render.mockImplementation((scene: Scene) => {
      if (scene.children.includes(group)) {
        drewBeforeConfirmation = !screen.queryByRole('button', { name: '确认当前修复' })
      }
    })
    await act(async () => { finishParse(group) })
    expect(drewBeforeConfirmation).toBe(true)
    await waitFor(() => {
      expect(boundary.parse, 'One model response must not start a second unresolved parse').toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: '确认当前修复' })).toBeEnabled()
    })
    expect(screen.queryByText('正在载入 3D 模型...')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['needs-repair', 'unchecked'] as const)('preserves fresh %s inspection when an older checked list arrives', async (inspectionStatus) => {
    const list = deferred<Response>()
    mockApi(list.promise, { 'first.ldr': json(model('first.ldr', { inspectionStatus, canConfirm: false })) })
    render(<LdrawPreviewWorkspace />)
    await waitFor(() => expect(boundary.render).toHaveBeenCalled())

    await act(async () => { list.resolve(json({ models: [item('first.ldr')] })) })
    expect(screen.getByRole('button', { name: '待确认 0' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /first\.ldr/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '审核状态 (1)' }))
    const row = screen.getByRole('button', { name: /first\.ldr/ })
    expect(within(row).getByText(inspectionStatus === 'needs-repair' ? '需修复' : '待检查')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认当前修复' })).not.toBeInTheDocument()
  })

  it('keeps a newly confirmed model out of the ready list when its old list response arrives', async () => {
    const list = deferred<Response>()
    const fetchMock = mockApi(list.promise, { 'first.ldr': json(model()) })
    render(<LdrawPreviewWorkspace />)
    fireEvent.click(await screen.findByRole('button', { name: '确认当前修复' }))
    await screen.findByText('当前版本已确认')
    await act(async () => { list.resolve(json({ models: [item('first.ldr')] })) })

    expect(screen.getByRole('button', { name: '待确认 0' })).toBeInTheDocument()
    expect(screen.getByText(/确认记录总数 1/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '审核状态 (1)' }))
    expect(within(screen.getByRole('button', { name: /first\.ldr/ })).getByText('已确认')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/ldraw-preview', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ model: 'first.ldr', revision: 'first.ldr-revision' }),
    }))
  })

  it('continues to the next requested batch model after confirming removes the current one from the ready list', async () => {
    window.history.replaceState(null, '', '/dev/ldraw-preview?model=first.ldr&models=first.ldr,next.ldr')
    const fetchMock = mockApi(json({ models: [item('first.ldr'), item('next.ldr')] }), {
      'first.ldr': json(model()), 'next.ldr': json(model('next.ldr')),
    })
    const { container } = render(<LdrawPreviewWorkspace />)
    fireEvent.click(await screen.findByRole('button', { name: '确认当前修复' }))
    await screen.findByText('当前版本已确认')

    expect(screen.getByRole('button', { name: '待确认 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /first\.ldr/ })).not.toBeInTheDocument()
    const nextButton = screen.getByRole('button', { name: '下一个模型' })
    expect(nextButton).toBeEnabled()
    fireEvent.click(nextButton)

    await waitFor(() => expect(container.querySelector('[data-rendered-model]'))
      .toHaveAttribute('data-rendered-model', 'next.ldr'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('model=next.ldr'), expect.any(Object))
    expect(screen.getByRole('button', { name: '确认当前修复' })).toBeEnabled()
  })

  it('draws one requested idle frame without continuously queuing more frames', async () => {
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrame = 0
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id) }))
    mockApi(json({ models: [item('first.ldr')] }), { 'first.ldr': json(model()) })
    render(<LdrawPreviewWorkspace />)
    await screen.findByRole('button', { name: '确认当前修复' })
    expect(frames.size).toBe(1)
    const drawsBefore = boundary.render.mock.calls.length
    const updatesBefore = boundary.controlsUpdate.mock.calls.length

    const [[id, callback]] = [...frames]
    frames.delete(id)
    act(() => { callback(16) })

    expect(boundary.render).toHaveBeenCalledTimes(drawsBefore + 1)
    expect(boundary.controlsUpdate).toHaveBeenCalledTimes(updatesBefore + 1)
    expect(frames.size).toBe(0)
  })

  it('does not schedule or draw frames after renderer and controls are disposed on unmount', async () => {
    const queuedFrames: FrameRequestCallback[] = []
    const requestFrame = vi.fn((callback: FrameRequestCallback) => queuedFrames.push(callback))
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    mockApi(json({ models: [item('first.ldr')] }), { 'first.ldr': json(model()) })
    const { unmount } = render(<LdrawPreviewWorkspace />)
    await screen.findByRole('button', { name: '确认当前修复' })
    expect(queuedFrames.length).toBeGreaterThan(0)
    const drawsBefore = boundary.render.mock.calls.length
    const updatesBefore = boundary.controlsUpdate.mock.calls.length
    const requestsBefore = requestFrame.mock.calls.length

    unmount()
    expect(boundary.rendererDispose).toHaveBeenCalledOnce()
    expect(boundary.controlsDispose).toHaveBeenCalledOnce()
    // Even a callback already handed to the browser must be harmless after disposal.
    act(() => { queuedFrames.forEach((callback) => callback(16)) })

    expect(requestFrame).toHaveBeenCalledTimes(requestsBefore)
    expect(boundary.render).toHaveBeenCalledTimes(drawsBefore)
    expect(boundary.controlsUpdate).toHaveBeenCalledTimes(updatesBefore)
  })

  it('does not parse the previous MPD under the next model identity while its response is pending', async () => {
    const next = deferred<Response>()
    mockApi(json({ models: [item('first.ldr'), item('next.ldr')] }), {
      'first.ldr': json(model()), 'next.ldr': next.promise,
    })
    const { container } = render(<LdrawPreviewWorkspace />)
    await screen.findByRole('button', { name: '确认当前修复' })
    expect(boundary.parse).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: /next\.ldr.*待确认/ }))
    expect(screen.queryByRole('button', { name: '确认当前修复' })).not.toBeInTheDocument()
    expect(container.querySelector('[data-rendered-model]')).toBeNull()
    expect(boundary.parse).toHaveBeenCalledOnce()

    await act(async () => { next.resolve(json(model('next.ldr'))) })
    await screen.findByRole('button', { name: '确认当前修复' })
    expect(boundary.parse).toHaveBeenCalledTimes(2)
    expect(boundary.parse.mock.calls[1][0]).toContain('0 FILE next.ldr')
    expect(boundary.parse.mock.calls[1][0]).not.toContain('first.ldr')
    expect(container.querySelector('[data-rendered-model]')).toHaveAttribute('data-rendered-model', 'next.ldr')
  })
})
