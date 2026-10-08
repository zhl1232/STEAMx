import { expect, it } from 'vitest'
import { SubmitCompletionSchema } from './record-input'
it('accepts text or images for exploration records but rejects empty and whitespace', () => {
  expect(SubmitCompletionSchema.parse({kind:'progress',notes:'  我的预测  ',isPublic:true})).toMatchObject({notes:'我的预测',images:[],isPublic:true})
  expect(SubmitCompletionSchema.safeParse({kind:'progress',images:['https://example.com/sketch.webp']}).success).toBe(true)
  for (const notes of ['', '  \n ']) expect(SubmitCompletionSchema.safeParse({kind:'progress',images:[],notes}).success).toBe(false)
  expect(SubmitCompletionSchema.safeParse({kind:'progress',images:['invalid']}).success).toBe(false)
})
it('preserves final image requirements and rejects obsolete private publish requests', () => {
  expect(SubmitCompletionSchema.safeParse({kind:'final',notes:'完成',images:[]}).success).toBe(false)
  expect(SubmitCompletionSchema.safeParse({kind:'progress',notes:'旧私密保存',isPublic:false}).success).toBe(false)
})
