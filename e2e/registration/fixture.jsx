import React, { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from '@/lib/context/auth-context'
import { LoginPromptProvider, useLoginPrompt } from '@/lib/context/login-prompt-context'
import { ProjectProvider, useProjects } from '@/lib/context/project-context'
import { useLoginContinuation } from '@/hooks/use-login-continuation'
import { ObservationSubmitPhotoSection } from '@/components/features/bird-observation/observation-submit-photo-section'
import { ScienceExtensionQuestions } from '@/components/features/project/science-extension-questions'
import { TutorProvider, useTutorContext } from '@/components/features/tutor/tutor-context'
import { useRouter } from 'next/navigation'
import '@/app/globals.css'
function App() {
  const {user} = useAuth(); const { promptLogin } = useLoginPrompt()
  const { toggleCollection, startExploration } = useProjects()
  const collect = useLoginContinuation(() => toggleCollection(7))
  const start = useLoginContinuation(() => startExploration(7))
  const [draft,setDraft] = useState(''); const router = useRouter(); const tutor=useTutorContext()
  return <main className="p-6 space-y-4">
    <h1>公开项目内容</h1><output>{user ? '已经登录' : '游客'}</output>
    <textarea aria-label="项目草稿" value={draft} onChange={e=>setDraft(e.target.value)} />
    <button onClick={()=>promptLogin(collect)}>收藏项目</button>
    <button onClick={()=>promptLogin(start)}>开始项目</button>
    <button onClick={()=>promptLogin()}>手动登录</button>
    <button onClick={()=>router.push('/nature')}>站内切页</button>
    <button onClick={()=>window.open('/project/7','_blank')}>打开新标签</button>
    <ScienceExtensionQuestions projectId={7} questions={['为什么会这样？']} />
    <output aria-label="小迪草稿">{tutor.pendingDraft?.text}</output>
    <ObservationSubmitPhotoSection evidenceImages={[]} onEvidenceChange={()=>{}} />
    <div style={{height:1000}}>正文始终保留</div>
  </main>
}
createRoot(document.getElementById('root')).render(<StrictMode><AuthProvider><LoginPromptProvider><ProjectProvider><TutorProvider><App /></TutorProvider></ProjectProvider></LoginPromptProvider></AuthProvider></StrictMode>)
