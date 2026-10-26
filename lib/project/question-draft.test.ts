/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyQuestionDraft, loadQuestionDraft, saveQuestionDraft } from './question-draft'
beforeEach(()=>sessionStorage.clear())
describe('account isolated question drafts',()=>{
 it('retains text, recipient and step context in this session',()=>{const draft={...emptyQuestionDraft(),text:'这根线接哪里？',context:{area:'step' as const,step:2,title:'接线'},replyId:15,replyName:'同学'};saveQuestionDraft('a',1,draft);expect(loadQuestionDraft('a',1)).toEqual(draft)})
 it('does not persist guest content or leak across accounts',()=>{saveQuestionDraft(null,1,{...emptyQuestionDraft(),text:'guest'});expect(sessionStorage.length).toBe(0);saveQuestionDraft('a',1,{...emptyQuestionDraft(),text:'account a'});expect(loadQuestionDraft('b',1).text).toBe('');expect(loadQuestionDraft('a',1).text).toBe('')})
 it('clears account drafts on logout',()=>{saveQuestionDraft('a',1,{...emptyQuestionDraft(),text:'a'});loadQuestionDraft(null,1);expect(sessionStorage.length).toBe(0)})
 it('rejects malformed storage',()=>{sessionStorage.setItem('steamx:question-draft:a:1','{');expect(loadQuestionDraft('a',1)).toEqual(emptyQuestionDraft())})
})
