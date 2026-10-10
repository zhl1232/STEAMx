'use client'

import { useOptionalTutorContext } from '@/components/features/tutor/tutor-context'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'

export function ScienceExtensionQuestions({ projectId, questions }: { projectId: number; questions: string[] }) {
  const tutor = useOptionalTutorContext()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  if (!tutor) return null
  return <div className="mt-4 space-y-2">
    <p className="text-sm text-muted-foreground">问小迪（选做）：选一个问题，可修改后再发送。</p>
    {questions.map(question => <button key={question} type="button" className="block min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => {
      if (!user) { promptLogin(undefined, { title: '登录后问小迪', description: '登录后请重新选择问题，修改后再发送。' }); return }
      tutor.prefillDraft({ text: question, userId: user.id, projectId: String(projectId) })
    }}>{question}</button>)}
  </div>
}
