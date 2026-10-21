import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProjectRecordsClient } from './project-records-client'
const mocks=vi.hoisted(()=>({read:vi.fn(), exploring:true, user:{id:"test"} as {id:string} | null, start:vi.fn(), promptLogin:vi.fn(), toast:vi.fn()}))
vi.mock('@/lib/project/read-records',()=>({readProjectRecords:mocks.read}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}))
vi.mock('@/lib/context/auth-context',()=>({useAuth:()=>({user:mocks.user})}))
vi.mock('@/lib/context/login-prompt-context',()=>({useLoginPrompt:()=>({promptLogin:mocks.promptLogin})}))
vi.mock('@/lib/context/project-context',()=>({useProjects:()=>({isCompleted:()=>false,isExploring:()=>mocks.exploring,startExploration:mocks.start})}))
vi.mock('@/hooks/use-sync-project-interactions',()=>({useSyncProjectInteractions:()=>{}}))
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:mocks.toast})}))
vi.mock('@/components/features/project/complete-project-dialog',()=>({CompleteProjectDialog:({open,mode}:{open:boolean,mode:string})=>open ? <div role="dialog" aria-label={`${mode} dialog`} /> : null}))
vi.mock('@/components/features/project/record-type-picker-sheet',()=>({RecordTypePickerSheet:({open}:{open:boolean})=>open ? <div role="dialog" aria-label="记录类型选择" /> : null}))
vi.mock('@/components/ui/mobile-page-header',()=>({MobilePageHeader:()=>null}))
vi.mock('@/components/features/project/journey-record-timeline',()=>({JourneyRecordTimeline:({records}: {records:{notes:string}[]})=><div>{records.map((r,i)=><p key={i}>{r.notes}</p>)}</div>}))
beforeEach(()=>{
 vi.clearAllMocks()
 mocks.exploring=true
 mocks.user={id:'test'}
 mocks.start.mockReset()
 mocks.read.mockResolvedValue({id:1,status:'active',records:[]})
})
afterEach(()=>{cleanup();mocks.read.mockReset()})
it('shows a retry instead of empty records when the list or detail fails, then renders recovered data', async()=>{
 mocks.read.mockRejectedValueOnce(new Error('list failed')).mockRejectedValueOnce(new Error('detail failed')).mockResolvedValue({id:1,status:'active',records:[{notes:'恢复的测试记录',record_kind:'progress'}]})
 render(<ProjectRecordsClient projectId={149} projectTitle="贺卡" mode="project" completions={[]} totalRecordsCount={0}/>)
 await screen.findByRole('alert')
 expect(screen.queryByText('还没有探索记录')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'重试'}))
 await waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(2))
 await waitFor(()=>expect(screen.getByRole('button',{name:'重试'})).not.toBeDisabled())
 fireEvent.click(screen.getByRole('button',{name:'重试'}))
 await screen.findByText('恢复的测试记录')
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

const renderRecords = (mode: "project" | "observation" = "project") => render(
 <ProjectRecordsClient projectId={149} projectTitle="贺卡" mode={mode} completions={[]} totalRecordsCount={0}/>
)

it.each(['记录按钮', '卡片本体', '卡片标题'])('无记录时通过%s打开记录类型选择', async (entry) => {
 renderRecords()
 const button = screen.getAllByRole('button', {name:'记录我的发现'})[0]
 const card = button.closest('section')!
 expect(card).toHaveClass('cursor-pointer', 'hover:shadow-md')
 fireEvent.click(entry === '记录按钮' ? button : entry === '卡片本体' ? card : screen.getByText('记录我的项目过程'))
 expect(await screen.findByRole('dialog', {name:'记录类型选择'})).toBeInTheDocument()
 expect(screen.queryByRole('dialog', {name:'final dialog'})).not.toBeInTheDocument()
})

it('记录入口只有一个，手机桌面共用；页面只有一个 h1', async () => {
 mocks.read.mockResolvedValue({id:1,status:'active',records:[]})
 const {container} = renderRecords()
 const header = screen.getByTestId('desktop-records-header')
 expect(header).toHaveClass('hidden', 'md:flex')
 expect(header).toHaveTextContent('探索记录 · 贺卡')
 expect(container.querySelectorAll('h1')).toHaveLength(1)
 fireEvent.click((await screen.findAllByRole('button', {name:'记录我的发现'}))[0])
 expect(screen.queryByRole('button', {name:'+ 记录'})).not.toBeInTheDocument()
 expect(await screen.findByRole('dialog', {name:'记录类型选择'})).toBeInTheDocument()
})

it.each([
 ['progress', 'approved', '总结最终作品'],
 ['final', 'rejected', '修改后重提'],
])('已有 %s / %s 时保留记录入口且 %s 只打开 final 对话框', async (record_kind, status, label) => {
 mocks.read.mockResolvedValue({id:1,status:'active',records:[{record_kind,status,notes:'已有记录'}]})
 renderRecords()
 const finalButton = await screen.findByRole('button', {name:label})
 expect(screen.getAllByRole('button', {name:'记录我的发现'})[0]).toBeInTheDocument()
 fireEvent.click(finalButton)
 expect(await screen.findByRole('dialog', {name:'final dialog'})).toBeInTheDocument()
 expect(screen.queryByRole('dialog', {name:'记录类型选择'})).not.toBeInTheDocument()
})

it.each(['记录按钮', '卡片本体'])('有过程记录时通过%s继续记录', async (entry) => {
 mocks.read.mockResolvedValue({id:1,status:'active',records:[{record_kind:'progress',notes:'已有记录'}]})
 renderRecords()
 await screen.findByRole('button', {name:'总结最终作品'})
 const button = screen.getAllByRole('button', {name:'记录我的发现'})[0]
 fireEvent.click(entry === '记录按钮' ? button : button.closest('section')!)
 expect(await screen.findByRole('dialog', {name:'记录类型选择'})).toBeInTheDocument()
 expect(screen.queryByRole('dialog', {name:'final dialog'})).not.toBeInTheDocument()
})

it('未开始时只有开始按钮，开始成功后可记录', async () => {
 mocks.exploring=false
 mocks.read.mockResolvedValueOnce({id:null,status:null,records:[]})
 renderRecords()
 await waitFor(()=>expect(mocks.read).toHaveBeenCalledOnce())
 expect(screen.queryByRole('button', {name:/^(\+ )?记录$/})).not.toBeInTheDocument()
 fireEvent.click(screen.getAllByRole('button', {name:'开始我的项目'})[0])
 expect((await screen.findAllByRole('button', {name:'记录我的发现'}))[0]).toBeInTheDocument()
 expect(mocks.start).toHaveBeenCalledExactlyOnceWith(149)
})

it('未登录时开始项目仍提示登录', () => {
 mocks.user=null
 mocks.exploring=false
 renderRecords()
 fireEvent.click(screen.getAllByRole('button', {name:'开始我的项目'})[0])
 expect(mocks.promptLogin).toHaveBeenCalledOnce()
 expect(mocks.start).not.toHaveBeenCalled()
 expect(screen.queryByRole('button', {name:/^(\+ )?记录$/})).not.toBeInTheDocument()
})

it('开始失败时沿用错误提示', async () => {
 mocks.exploring=false
 mocks.read.mockResolvedValue({id:null,status:null,records:[]})
 mocks.start.mockRejectedValue(new Error('restricted'))
 renderRecords()
 fireEvent.click(screen.getAllByRole('button', {name:'开始我的项目'})[0])
 await waitFor(()=>expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({title:'无法开始我的项目',variant:'destructive'})))
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('观察模式不显示桌面记录按钮或项目卡片', async () => {
 renderRecords('observation')
 await waitFor(()=>expect(mocks.read).toHaveBeenCalledOnce())
 expect(screen.queryByRole('button', {name:/^(\+ )?记录$/})).not.toBeInTheDocument()
 expect(screen.queryByText('记录我的项目过程')).not.toBeInTheDocument()
})

const progressRecord = {
 id: 41, userId: 'author', projectId: 149, explorationId: 1, author: '探索者',
 completedAt: '刚刚', proofImages: [], notes: '第一步', isPublic: true,
 likes: 0, coins: 0, status: 'approved' as const, recordKind: 'progress' as const,
}

it('scrolls to and temporarily highlights a grouped step even when it is not the representative', async () => {
 mocks.user = null
 vi.useFakeTimers()
 const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
 try {
  const {container} = render(<ProjectRecordsClient projectId={149} projectTitle="贺卡" mode="project"
   completions={[progressRecord, {...progressRecord, id: 42, recordKind: 'final'}]}
   totalRecordsCount={2} highlightCompletionId={41} />)
  const anchor = document.getElementById('exploration-record-41')!
  const card = anchor.closest('section')!
  expect(scroll).toHaveBeenCalledWith({behavior:'smooth', block:'center'})
  expect(scroll.mock.instances[0]).toBe(anchor)
  expect(card).toHaveClass('ring-2')
  expect(screen.getByRole('link', {name:/完整探索详情/})).toHaveAttribute('href', '/works/42')
  expect(container.querySelectorAll('#exploration-record-41')).toHaveLength(1)
  await act(async () => {vi.advanceTimersByTime(2500)})
  expect(card).not.toHaveClass('ring-2')
 } finally {
  scroll.mockRestore()
  vi.useRealTimers()
 }
})

it('does not scroll when the highlighted record is unavailable', async () => {
 mocks.user = null
 const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
 try {
  render(<ProjectRecordsClient projectId={149} projectTitle="贺卡" mode="project"
   completions={[progressRecord]} totalRecordsCount={1} highlightCompletionId={999} />)
  expect(scroll).not.toHaveBeenCalled()
 } finally { scroll.mockRestore() }
})
