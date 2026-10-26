import {act,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {SupportChat} from './support-chat'
vi.mock('next/image',()=>({default:(props:Record<string,unknown>)=>{const {unoptimized,...rest}=props;void unoptimized;return <span {...rest} />}}))
const conversation={id:'conversation',channel:'platform',user_id:'user',status:'open',user_read_seq:0,staff_read_seq:0,last_message_seq:0,updated_at:''}
const snapshot={conversation,messages:[],nextCursor:null}
beforeEach(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})})
afterEach(()=>{vi.unstubAllGlobals()})
describe('official support composer',()=>{
  it('displays store-only copy and identity from the persisted conversation channel',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({...snapshot,conversation:{...conversation,channel:'store'}})})))
    const resolved=vi.fn()
    render(<SupportChat conversationId="conversation" admin onChannelResolved={resolved} />)
    await screen.findByText('商品、订单或配送遇到问题？请留下具体情况，商城客服会在此回复。')
    expect(screen.queryByText(/课程使用、账号或社区遇到问题/)).not.toBeInTheDocument()
    expect(resolved).toHaveBeenCalledWith('store')
  })

  it('keeps the same request identity across an uncertain send retry',async()=>{
    const bodies:Record<string,unknown>[]=[]
    const fetchMock=vi.fn(async(url:string,options?:RequestInit)=>{
      if(url.endsWith('/messages')&&options?.method==='POST'){
        bodies.push(JSON.parse(String(options.body)))
        return {ok:bodies.length>1,status:bodies.length>1?200:500,json:async()=>bodies.length>1?{message:{id:'saved'}}:{error:'暂时失败'}}
      }
      return {ok:true,json:async()=>snapshot}
    })
    vi.stubGlobal('fetch',fetchMock)
    render(<SupportChat conversationId="conversation" />)
    await screen.findByText('课程使用、账号或社区遇到问题？请留下具体情况，我们会在此回复。')
    fireEvent.change(screen.getByLabelText('描述问题'),{target:{value:'零件缺失'}})
    fireEvent.click(screen.getByRole('button',{name:'发送留言'}))
    await screen.findByRole('button',{name:'重试发送'})
    expect(screen.getByLabelText('描述问题')).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'重试发送'}))
    await waitFor(()=>expect(bodies).toHaveLength(2))
    expect(bodies[1]).toEqual(bodies[0])
    await waitFor(()=>expect(screen.getByLabelText('描述问题')).toHaveValue(''))
  })
  it('allows editing after a definitive content rejection',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_url:string,options?:RequestInit)=>options?.method==='POST'?{ok:false,status:422,json:async()=>({error:'请修改内容'})}:{ok:true,json:async()=>snapshot}))
    render(<SupportChat conversationId="conversation" />)
    await screen.findByText('课程使用、账号或社区遇到问题？请留下具体情况，我们会在此回复。')
    fireEvent.change(screen.getByLabelText('描述问题'),{target:{value:'需要修改的内容'}})
    fireEvent.click(screen.getByRole('button',{name:'发送留言'}))
    await screen.findByText('请修改内容')
    expect(screen.getByLabelText('描述问题')).not.toBeDisabled()
  })
  it('opens image selection from the styled button and includes the uploaded attachment when sending',async()=>{
    let finishUpload:(value:unknown)=>void=()=>{}
    const upload=new Promise(resolve=>{finishUpload=resolve})
    const bodies:Record<string,unknown>[]=[]
    vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
      if(url.endsWith('/attachments'))return upload
      if(url.endsWith('/messages')&&options?.method==='POST')bodies.push(JSON.parse(String(options.body)))
      return {ok:true,json:async()=>snapshot}
    }))
    render(<SupportChat conversationId="conversation" />)
    await screen.findByText('课程使用、账号或社区遇到问题？请留下具体情况，我们会在此回复。')
    const input=screen.getByLabelText('添加客服图片')
    const openPicker=vi.spyOn(input,'click')
    fireEvent.click(screen.getByRole('button',{name:'添加图片'}))
    expect(openPicker).toHaveBeenCalledOnce()
    const file=new File(['image'],'broken-piece.png',{type:'image/png'})
    fireEvent.change(input,{target:{files:[file]}})
    expect(screen.getByRole('button',{name:'正在上传图片…'})).toBeDisabled()
    expect(input).toBeDisabled()
    finishUpload({ok:true,json:async()=>({attachment:{id:'uploaded-image'}})})
    await screen.findByRole('button',{name:'图片 1 · 移除'})
    fireEvent.click(screen.getByRole('button',{name:'发送留言'}))
    await waitFor(()=>expect(bodies).toHaveLength(1))
    expect(bodies[0].attachmentIds).toEqual(['uploaded-image'])
  })
  it('does not mark a hidden conversation as read',async()=>{
    const fetchMock=vi.fn(async()=>({ok:true,json:async()=>snapshot}))
    vi.stubGlobal('fetch',fetchMock)
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'})
    render(<SupportChat conversationId="conversation" />)
    await act(async()=>{await Promise.resolve()})
    expect(fetchMock).not.toHaveBeenCalled()
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
    fireEvent(window,new Event('focus'))
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(1))
  })
  it('fills more than fifty reconnect messages before marking the new tail read',async()=>{
    let total=1
    const readSeqs:number[]=[]
    const afterCursors:number[]=[]
    let releaseMiddle:()=>void=()=>{}
    const middle=new Promise<void>(resolve=>{releaseMiddle=resolve})
    const message=(seq:number)=>({id:`message-${seq}`,seq,actor_id:'staff',sender_role:'admin',client_id:`client-${seq}`,content:`回复 ${seq}`,context:{},created_at:'2026-10-26T00:00:00Z'})
    vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
      const parsed=new URL(url,'https://example.test')
      if(parsed.pathname.endsWith('/read')){
        readSeqs.push(JSON.parse(String(options?.body)).seq)
        return {ok:true,json:async()=>({success:true})}
      }
      const after=parsed.searchParams.get('after')
      if(after!==null){
        const start=Number(after);afterCursors.push(start)
        if(start===51)await middle
        const messages=Array.from({length:Math.min(50,total-start)},(_,i)=>message(start+i+1))
        return {ok:true,json:async()=>({conversation:{...conversation,last_message_seq:total},messages,nextCursor:null,nextAfterCursor:start+50<total?start+50:null})}
      }
      const first=Math.max(1,total-49)
      return {ok:true,json:async()=>({conversation:{...conversation,last_message_seq:total},messages:Array.from({length:total-first+1},(_,i)=>message(first+i)),nextCursor:first>1?first:null})}
    }))
    render(<SupportChat conversationId="conversation" />)
    await waitFor(()=>expect(readSeqs).toEqual([1]))
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'})
    total=121
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
    fireEvent(window,new Event('online'))
    await waitFor(()=>expect(afterCursors).toContain(51))
    expect(readSeqs).toEqual([1])
    releaseMiddle()
    await waitFor(()=>expect(readSeqs).toEqual([1,121]))
    await waitFor(()=>expect(screen.getAllByRole('article')).toHaveLength(121))
    expect(screen.getByText('回复 2')).toBeInTheDocument()
    expect(afterCursors).toEqual([0,1,51,101])
  })
  it('submits the rendered sequence when resolving and refreshes on conflict',async()=>{
    const bodies:Record<string,unknown>[]=[]
    let latest=1
    vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
      if(options?.method==='PATCH'){
        bodies.push(JSON.parse(String(options.body)));latest=2
        return {ok:false,status:409,json:async()=>({error:'会话有新留言，请刷新后再处理'})}
      }
      if(url.endsWith('/read'))return {ok:true,json:async()=>({success:true})}
      const after=Number(new URL(url,'https://example.test').searchParams.get('after')??0)
      const messages=Array.from({length:latest-after},(_,i)=>({id:`m-${after+i+1}`,seq:after+i+1,sender_role:'user',client_id:'client',content:`新留言 ${after+i+1}`,context:{},created_at:'2026-10-26T00:00:00Z'}))
      return {ok:true,json:async()=>({conversation:{...conversation,last_message_seq:latest},messages,nextCursor:null,nextAfterCursor:null})}
    }))
    render(<SupportChat conversationId="conversation" admin />)
    await screen.findByText('新留言 1')
    fireEvent.click(screen.getByRole('button',{name:'标为已处理'}))
    await screen.findByText('新留言 2')
    expect(bodies).toEqual([{status:'resolved',expectedLastMessageSeq:1}])
    expect(screen.getByRole('button',{name:'标为已处理'})).toBeInTheDocument()
  })

})
