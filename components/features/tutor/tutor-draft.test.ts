import { expect, test } from 'vitest'
import { decideTutorDraft } from './tutor-draft'
const draft = { text: '火山为什么喷发？', userId: 'a', projectId: '1213' }
test('only fills an empty composer in the same authenticated project', () => {
  expect(decideTutorDraft(draft, 'a', 'project', '1213', '', 0)).toBe('prefill')
  expect(decideTutorDraft(draft, 'a', 'project', '1213', '我的记录', 0)).toBe('preserve')
  expect(decideTutorDraft(draft, 'a', 'project', '1213', '', 1)).toBe('preserve')
  expect(decideTutorDraft(draft, 'b', 'project', '1213', '', 0)).toBe('discard')
  expect(decideTutorDraft(draft, undefined, 'project', '1213', '', 0)).toBe('discard')
  expect(decideTutorDraft(draft, 'a', 'project', '1215', '', 0)).toBe('discard')
  expect(decideTutorDraft(draft, 'a', 'course', '1213', '', 0)).toBe('discard')
})
