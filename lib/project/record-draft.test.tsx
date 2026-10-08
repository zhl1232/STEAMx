import { beforeEach, expect, it } from 'vitest'
import { syncRecordDraftOwner, recordDraftKey, readRecordDraft, writeRecordDraft } from './record-draft'
beforeEach(() => sessionStorage.clear())
it('restores text only within an account and project, clears on logout and account switch', () => {
  syncRecordDraftOwner('a')
  const key=recordDraftKey('a',149)
  writeRecordDraft(key,'预测')
  expect(readRecordDraft(key)).toBe('预测')
  expect(readRecordDraft(recordDraftKey('a',150))).toBe('')
  syncRecordDraftOwner('a')
  expect(readRecordDraft(key)).toBe('预测')
  syncRecordDraftOwner('b')
  expect(readRecordDraft(key)).toBe('')
  writeRecordDraft(recordDraftKey('b',149),'观察')
  syncRecordDraftOwner(null)
  expect(readRecordDraft(recordDraftKey('b',149))).toBe('')
})
