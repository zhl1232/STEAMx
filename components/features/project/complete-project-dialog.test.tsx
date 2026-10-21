import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompleteProjectDialog } from './complete-project-dialog'

const uploadFileSecureWithProgress = vi.fn()
const toast = vi.fn()
const authState = {user: {id: 'user-1'} as {id:string} | null}
const submitExplorationPost = vi.fn()

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: authState.user }),
}))

vi.mock('@/lib/context/project-context', () => ({
  useOptionalProjects: () => ({ submitExplorationPost: (...args: unknown[]) => submitExplorationPost(...args) }),
}))

vi.mock('@/lib/utils/upload', () => ({
  uploadFileSecureWithProgress: (...args: unknown[]) => uploadFileSecureWithProgress(...args),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}))

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

describe('CompleteProjectDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    uploadFileSecureWithProgress.mockReset()
    toast.mockReset()
    submitExplorationPost.mockReset()
    vi.unstubAllGlobals()
  })

  it('uploads and submits multiple selected work photos in selection order', async () => {
    uploadFileSecureWithProgress.mockImplementation(async (file: File) => {
      return `https://assets.example.com/project-completions/user-1/${file.name}`
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 8 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const onSuccess = vi.fn()
    render(
      <CompleteProjectDialog
        projectTitle="长颈鹿"
        submitEndpoint="/api/courses/5/lessons/33/works"
        open
        onOpenChange={vi.fn()}
        onSuccess={onSuccess}
      />,
    )

    const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement
    expect(input).not.toBeNull()

    fireEvent.change(input, {
      target: {
        files: [
          new File(['front'], 'front.webp', { type: 'image/webp' }),
          new File(['side'], 'side.webp', { type: 'image/webp' }),
        ],
      },
    })

    await waitFor(() => expect(screen.getByText('2/9')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('继续添加照片（还可 7 张）')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '跳过，直接提交' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const request = fetchMock.mock.calls[0]
    expect(request[0]).toBe('/api/courses/5/lessons/33/works')
    expect(JSON.parse(request[1].body)).toMatchObject({
      images: [
        'https://assets.example.com/project-completions/user-1/front.webp',
        'https://assets.example.com/project-completions/user-1/side.webp',
      ],
    })
    expect(onSuccess).toHaveBeenCalledWith({ id: 8, status: 'pending', recordKind: 'final' })

    vi.unstubAllGlobals()
  })
})


it('keeps an unfinished project record open after a failed save and allows retry', async () => {
  uploadFileSecureWithProgress.mockResolvedValue('https://assets.example.com/project-completions/user-1/sketch.webp')
  submitExplorationPost.mockRejectedValueOnce(new Error('模拟网络失败')).mockResolvedValueOnce({id: 19, status: 'pending', recordKind: 'progress'})
  const onSuccess = vi.fn(), onOpenChange = vi.fn()
  render(<CompleteProjectDialog projectId={149} projectTitle="LED 发光贺卡" mode="progress" open onOpenChange={onOpenChange} onSuccess={onSuccess} />)
  fireEvent.change(document.querySelector('input[type="file"][multiple]')!, {target: {files: [new File(['sketch'], 'sketch.webp', {type: 'image/webp'})]}})
  await waitFor(() => expect(screen.getByText('1/9')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', {name: '发布记录'}))
  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({title: '提交失败', description: '模拟网络失败'})))
  expect(onSuccess).not.toHaveBeenCalled()
  expect(onOpenChange).not.toHaveBeenCalled()
  expect(screen.getByText('1/9')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', {name: '发布记录'}))
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({id: 19, status: 'pending', recordKind: 'progress'}))
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({title: '审核中', description: expect.stringContaining('AI 审核通过后自动公开')}))
  expect(submitExplorationPost).toHaveBeenLastCalledWith(149, expect.objectContaining({images: ['https://assets.example.com/project-completions/user-1/sketch.webp']}), expect.objectContaining({kind: 'progress'}))
})


afterEach(() => { cleanup(); sessionStorage.clear(); authState.user={id:'user-1'}; submitExplorationPost.mockReset(); toast.mockReset(); vi.unstubAllGlobals() })
it('publishes text only, blocks duplicate submissions, clears recovered text on success', async () => {
  let finish!: (v: unknown) => void
  submitExplorationPost.mockImplementation(() => new Promise(resolve => {finish=resolve}))
  const onSuccess=vi.fn()
  render(<CompleteProjectDialog projectId={149} projectTitle="贺卡" mode="progress" open onOpenChange={vi.fn()} onSuccess={onSuccess} />)
  expect(screen.queryByLabelText('公开这条探索记录')).not.toBeInTheDocument()
  const publish=screen.getByRole('button',{name:'发布记录'})
  expect(publish).toBeDisabled()
  fireEvent.change(screen.getByLabelText('想记录什么？'),{target:{value:'我预测会亮'}})
  fireEvent.click(publish);fireEvent.click(publish)
  expect(submitExplorationPost).toHaveBeenCalledTimes(1)
  expect(submitExplorationPost).toHaveBeenCalledWith(149,expect.objectContaining({notes:'我预测会亮',images:[],isPublic:true}),expect.objectContaining({kind:'progress'}))
  finish({id:30,status:'pending',recordKind:'progress'})
  await waitFor(()=>expect(onSuccess).toHaveBeenCalled())
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({description:expect.stringContaining('AI 审核通过后自动公开')}))
  expect(sessionStorage.getItem('steamx:record-draft:user-1:149')).toBeNull()
})
it('recovers text after close and remount, but does not expose it to another account', () => {
  const props={projectId:149,projectTitle:'贺卡',mode:'progress' as const,open:true,onOpenChange:vi.fn(),onSuccess:vi.fn()}
  const view=render(<CompleteProjectDialog {...props} />)
  fireEvent.change(screen.getByLabelText('想记录什么？'),{target:{value:'还没发布的观察'}})
  fireEvent.click(screen.getByRole('button',{name:'取消'}))
  view.unmount()
  const next=render(<CompleteProjectDialog {...props} />)
  expect(screen.getByLabelText('想记录什么？')).toHaveValue('还没发布的观察')
  authState.user={id:'other'};next.rerender(<CompleteProjectDialog {...props} />)
  expect(screen.getByLabelText('想记录什么？')).toHaveValue('')
})

it('does not move a late upload from the old account into the new editing session', async () => {
  let finishUpload!: (url: string) => void
  uploadFileSecureWithProgress.mockImplementationOnce(() => new Promise(resolve => { finishUpload = resolve }))
  const props = {projectId:149, projectTitle:'贺卡', mode:'progress' as const, open:true, onOpenChange:vi.fn(), onSuccess:vi.fn()}
  const view = render(<CompleteProjectDialog {...props} />)
  fireEvent.change(document.querySelector('input[type="file"][multiple]')!, {target:{files:[new File(['old'], 'old.webp', {type:'image/webp'})]}})
  authState.user = {id:'other'}
  view.rerender(<CompleteProjectDialog {...props} />)
  finishUpload('https://assets.example.com/project-completions/user-1/old.webp')
  await waitFor(() => expect(screen.getByText('0/9')).toBeInTheDocument())
  expect(screen.queryByText('1/9')).not.toBeInTheDocument()
  expect(screen.getByLabelText('想记录什么？')).toHaveValue('')
})

it('does not publish recovered text automatically or accept a draft response as published', async () => {
  sessionStorage.setItem('steamx:record-draft:user-1:149','尚未发布')
  submitExplorationPost.mockResolvedValue({id:31,status:'draft',recordKind:'progress'})
  const onSuccess=vi.fn()
  render(<CompleteProjectDialog projectId={149} projectTitle="贺卡" mode="progress" open onOpenChange={vi.fn()} onSuccess={onSuccess}/>)
  expect(screen.getByLabelText('想记录什么？')).toHaveValue('尚未发布')
  expect(submitExplorationPost).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'发布记录'}))
  await waitFor(()=>expect(toast).toHaveBeenCalledWith(expect.objectContaining({title:'提交失败'})))
  expect(onSuccess).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('steamx:record-draft:user-1:149')).toBe('尚未发布')
})
