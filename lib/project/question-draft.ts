export type QuestionContext = { area: 'general' | 'materials' | 'step'; step?: number; title?: string }
export type QuestionDraft = { text: string; context: QuestionContext; replyId: number | null; replyName: string | null }
const prefix='steamx:question-draft:'
export const emptyQuestionDraft = (): QuestionDraft => ({ text:'',context:{area:'general'},replyId:null,replyName:null })
export function loadQuestionDraft(userId: string | null, projectId: string | number): QuestionDraft {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix) && (!userId || !key.startsWith(`${prefix}${userId}:`))) sessionStorage.removeItem(key)
    if (!userId) return emptyQuestionDraft()
    const raw = sessionStorage.getItem(`${prefix}${userId}:${projectId}`)
    if (!raw) return emptyQuestionDraft()
    const parsed = JSON.parse(raw)
    if (typeof parsed.text !== 'string' || parsed.text.length>2000 || !['general','materials','step'].includes(parsed.context?.area)) return emptyQuestionDraft()
    if (parsed.context.area==='step' && (!Number.isInteger(parsed.context.step) || parsed.context.step<1 || parsed.context.step>100)) return emptyQuestionDraft()
    return {text:parsed.text,context:{area:parsed.context.area,step:parsed.context.step,title:typeof parsed.context.title==='string'?parsed.context.title.slice(0,200):undefined},replyId:Number.isSafeInteger(parsed.replyId)&&parsed.replyId>0?parsed.replyId:null,replyName:typeof parsed.replyName==='string'?parsed.replyName.slice(0,100):null}
  } catch { return emptyQuestionDraft() }
}
export function saveQuestionDraft(userId: string | null, projectId: string | number, draft: QuestionDraft) {
  if (!userId) return
  try { const key=`${prefix}${userId}:${projectId}`; if (draft.text) sessionStorage.setItem(key,JSON.stringify(draft)); else sessionStorage.removeItem(key) } catch { /* In-memory draft remains usable. */ }
}
