import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileEditor } from './profile-editor'
import { EditProfileDialog } from './edit-profile-dialog'

const mocks = vi.hoisted(() => ({
  refreshProfile: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  compress: vi.fn(),
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, refreshProfile: mocks.refreshProfile }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/utils/image-compression', () => ({
  RAW_INPUT_CEILING_MB: 50,
  compressImageForBucket: mocks.compress,
}))

const initialProfile = {
  username: 'explorer',
  display_name: '小探索家',
  bio: '喜欢动手',
  gender: null,
  birth_year: null,
  birth_month: null,
  avatar_url: '/avatars/default-3.svg',
  equipped_title: '科学新星',
  last_uploaded_avatar_url: '/storage/v1/object/public/avatars/user-1/previous.jpg',
}
const uploadedUrl = '/storage/v1/object/public/avatars/user-1/new.jpg'
const previewUrl = 'blob:profile-preview'
const fetchMock = vi.fn<typeof fetch>()
let patchPayloads: Record<string, unknown>[]
let failPatch: boolean

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  failPatch = false
  patchPayloads = []
  mocks.refreshProfile.mockResolvedValue(undefined)
  mocks.compress.mockImplementation(async (file: File) => file)
  vi.stubGlobal('fetch', fetchMock)
  const NativeURL = URL
  vi.stubGlobal('URL', class extends NativeURL {
    static createObjectURL = vi.fn(() => previewUrl)
    static revokeObjectURL = vi.fn()
  })
  fetchMock.mockImplementation(async (url, init) => {
    if (url === '/api/upload') return response({ publicUrl: uploadedUrl })
    if (init?.method === 'PATCH') {
      const payload = JSON.parse(init.body as string)
      patchPayloads.push(payload)
      if (failPatch) return response({ error: '暂时无法保存，请重试' }, 503)
      return response({ profile: { ...initialProfile, ...payload } })
    }
    return response({ profile: initialProfile })
  })
})

afterEach(() => { vi.unstubAllGlobals() })

async function loadEditor(props: React.ComponentProps<typeof ProfileEditor> = {}) {
  const result = render(<ProfileEditor {...props} />)
  await screen.findByDisplayValue('小探索家')
  return result
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: '保存更改' }))
}

function chooseFile(container: HTMLElement) {
  const file = new File(['image-content'], 'photo.png', { type: 'image/png' })
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } })
  return file
}

function clickAvatar(container: HTMLElement, src: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'))
    .find(candidate => candidate.querySelector('img')?.getAttribute('src') === src)
  expect(button, `selectable avatar ${src}`).toBeTruthy()
  fireEvent.click(button!)
}

describe('shared profile editor', () => {
  it('focuses the nickname shortcut after loading and does not save an unchanged form', async () => {
    await loadEditor({ initialTarget: 'display_name' })
    expect(screen.getByLabelText('昵称')).toHaveFocus()
    expect(screen.getByRole('button', { name: '保存更改' })).toBeDisabled()
    expect(screen.getByLabelText('昵称')).toHaveAttribute('maxLength', '30')
    expect(screen.getByLabelText('简介')).toHaveAttribute('maxLength', '30')
  })

  it('retries a failed load instead of showing a submittable empty form', async () => {
    fetchMock.mockResolvedValueOnce(response({ error: '资料暂时无法加载' }, 503))
    render(<ProfileEditor />)
    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument()
    expect(screen.queryByText('资料暂时无法加载')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存更改' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /重试/ }))
    await screen.findByDisplayValue('小探索家')
    expect(patchPayloads).toHaveLength(0)
  })

  it('shows a Chinese re-login hint instead of the raw Unauthorized error', async () => {
    fetchMock.mockResolvedValueOnce(response({ error: 'Unauthorized' }, 401))
    render(<ProfileEditor />)
    expect(await screen.findByText('登录已失效，请重新登录')).toBeInTheDocument()
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument()
  })

  it('rejects a blank nickname locally with a focused field', async () => {
    await loadEditor()
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '   ' } })
    save()
    expect(await screen.findByText('昵称不能为空')).toBeInTheDocument()
    expect(screen.getByLabelText('昵称')).toHaveFocus()
    expect(patchPayloads).toHaveLength(0)
  })

  it('saves the selected preset without uploading a previously selected local file', async () => {
    const { container } = await loadEditor({ initialTarget: 'avatar' })
    chooseFile(container)
    clickAvatar(container, '/avatars/default-1.svg')
    save()
    await waitFor(() => expect(patchPayloads).toHaveLength(1))
    expect(patchPayloads[0]).toMatchObject({ avatar_url: '/avatars/default-1.svg', equipped_title: '科学新星' })
    expect(mocks.compress).not.toHaveBeenCalled()
  })

  it('keeps both the persisted upload and the pending file selectable when switching presets', async () => {
    const { container } = await loadEditor({ initialTarget: 'avatar' })
    chooseFile(container)
    clickAvatar(container, '/avatars/default-1.svg')
    clickAvatar(container, initialProfile.last_uploaded_avatar_url)
    clickAvatar(container, previewUrl)
    save()
    await waitFor(() => expect(patchPayloads).toHaveLength(1))
    expect(patchPayloads[0].avatar_url).toBe(uploadedUrl)
    expect(mocks.compress).toHaveBeenCalledTimes(1)
  })

  it('preserves the draft and reuses an uploaded image when retrying a failed profile save', async () => {
    failPatch = true
    const { container } = await loadEditor({ initialTarget: 'avatar' })
    chooseFile(container)
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '新昵称' } })
    save()
    await screen.findByText('暂时无法保存，请重试')
    expect(screen.getByLabelText('昵称')).toHaveValue('新昵称')
    failPatch = false
    save()
    await waitFor(() => expect(patchPayloads).toHaveLength(2))
    expect(patchPayloads.map(payload => payload.avatar_url)).toEqual([uploadedUrl, uploadedUrl])
    expect(mocks.compress).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/upload')).toHaveLength(1)
  })

  it('keeps the selected photo and draft when avatar upload fails without sending a PATCH', async () => {
    const { container } = await loadEditor({ initialTarget: 'avatar' })
    chooseFile(container)
    fetchMock.mockResolvedValueOnce(response({ error: '头像上传失败，请重试' }, 503))
    save()
    await screen.findByText('头像上传失败，请重试')
    expect(patchPayloads).toHaveLength(0)
    expect(screen.getByRole('button', { name: '新选的头像' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('昵称')).toHaveValue('小探索家')
    save()
    await waitFor(() => expect(patchPayloads).toHaveLength(1))
    expect(patchPayloads[0].avatar_url).toBe(uploadedUrl)
  })

  it('ignores an old profile response after the editor was closed and reopened', async () => {
    let resolveOld!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve }))
    const first = render(<ProfileEditor />)
    first.unmount()
    await loadEditor()
    resolveOld(response({ profile: { ...initialProfile, display_name: '过期响应' } }))
    await waitFor(() => expect(screen.getByLabelText('昵称')).toHaveValue('小探索家'))
    expect(screen.queryByDisplayValue('过期响应')).not.toBeInTheDocument()
  })

  it('asks before discarding a draft and lets the user continue editing', async () => {
    const onCancel = vi.fn()
    await loadEditor({ onCancel })
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '还没有保存' } })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: '继续编辑' }))
    expect(screen.getByLabelText('昵称')).toHaveValue('还没有保存')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(await screen.findByRole('button', { name: '放弃修改' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('reports successful persistence even if the subsequent auth refresh fails', async () => {
    mocks.refreshProfile.mockRejectedValueOnce(new Error('refresh unavailable'))
    const onSaved = vi.fn()
    await loadEditor({ onSaved })
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '已保存的昵称' } })
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '资料已保存' }))
    expect(screen.getByRole('button', { name: '保存更改' })).toBeDisabled()
  })

  it('protects a dirty draft when the dialog receives Escape', async () => {
    render(<EditProfileDialog><button>打开资料</button></EditProfileDialog>)
    fireEvent.click(screen.getByRole('button', { name: '打开资料' }))
    await screen.findByDisplayValue('小探索家')
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '还没有保存' } })
    fireEvent.keyDown(screen.getByLabelText('昵称'), { key: 'Escape' })
    expect(await screen.findByRole('button', { name: '继续编辑' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '编辑资料' })).toBeInTheDocument()
  })

  it('requires both birth fields and focuses the missing month', async () => {
    const user = userEvent.setup()
    await loadEditor()
    await user.click(screen.getByRole('combobox', { name: '出生年份' }))
    await user.click(await screen.findByRole('option', { name: '2015 年' }))
    save()
    expect(await screen.findByText('出生年月需要同时选择')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '出生月份' })).toHaveFocus()
    expect(patchPayloads).toHaveLength(0)
  })

  it('keeps the current title available after switching to automatic or hidden', async () => {
    const user = userEvent.setup()
    await loadEditor()
    await user.click(screen.getByRole('combobox', { name: '主页称号' }))
    await user.click(await screen.findByRole('option', { name: '隐藏称号' }))
    await user.click(screen.getByRole('combobox', { name: '主页称号' }))
    await user.click(await screen.findByRole('option', { name: '科学新星（当前佩戴）' }))
    expect(screen.getByRole('button', { name: '保存更改' })).toBeDisabled()
  })

  it('blocks duplicate submission and dismissal until the save finishes', async () => {
    let resolvePatch!: (response: Response) => void
    render(<EditProfileDialog><button>打开资料</button></EditProfileDialog>)
    fireEvent.click(screen.getByRole('button', { name: '打开资料' }))
    await screen.findByDisplayValue('小探索家')
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '保存中的昵称' } })
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolvePatch = resolve }))
    const form = screen.getByLabelText('昵称').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    fireEvent.click(screen.getByRole('button', { name: '关闭编辑资料' }))
    expect(screen.getByRole('dialog', { name: '编辑资料' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1)
    resolvePatch(response({ profile: { ...initialProfile, display_name: '保存中的昵称' } }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('guards the security link and follows the selected destination only after discard', async () => {
    await loadEditor()
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '新昵称' } })
    fireEvent.click(screen.getByRole('link', { name: /账号安全设置/ }))
    expect(mocks.push).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: '放弃修改' }))
    expect(mocks.push).toHaveBeenCalledWith('/settings/security')
  })
})

describe('edit profile dialog history', () => {
  it('pushes a history marker on open so system back closes the dialog instead of leaving the page', async () => {
    const pushState = vi.spyOn(window.history, 'pushState')
    render(<EditProfileDialog><button>打开资料</button></EditProfileDialog>)
    fireEvent.click(screen.getByRole('button', { name: '打开资料' }))
    await screen.findByRole('dialog', { name: '编辑资料' })
    expect(pushState).toHaveBeenCalledWith(
      expect.objectContaining({ __steamxEditProfileDialog: true }),
      '',
    )
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
