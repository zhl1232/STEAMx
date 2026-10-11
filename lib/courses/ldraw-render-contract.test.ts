import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'
import { expect, it } from 'vitest'

import { GET } from '@/app/api/courses/ldraw-step/route'
import { createPackedLdrawStep } from '@/lib/utils/ldraw-mpd'

it.each([0, 1])('serves step %s byte-for-byte without material accounting colour substitutions', async (step) => {
  const model = '3-hu-die.mpd'
  const source = readFileSync(`public/courses/ldraw/${model}`, 'utf8')
  const expected = createPackedLdrawStep(source, step)
  const response = await GET(new NextRequest(`http://localhost/api/courses/ldraw-step?model=${model}&step=${step}`))
  expect(response.status).toBe(200)
  expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from(expected.mpdText))
})

// Keep this boundary check text-only: no WebGL or heavyweight LDrawLoader in Node tests.
it('passes raw step text to the parser and keeps accounting helpers out of the render path', () => {
  const source = readFileSync('components/features/courses/building-3d-workspace.tsx', 'utf8')
  expect(source).toContain('parseLdrawStepModel(await response.text())')
  const parser = source.slice(source.indexOf('const parseLdrawStepModel ='), source.indexOf('if (content.ldrawModelUrl) {', source.indexOf('const parseLdrawStepModel =')))
  expect(parser).toMatch(/parsePackedLdrawModelText\(\s*ldrawLoader,\s*mpdText,/)
  expect(parser).not.toMatch(/lesson-materials|prepareLessonBomForCourse|compareLessonMaterials|sameDisplayColor/)
  const accountingImports = source.match(/import\s+[^;]+from\s+["'][^"']*lesson-materials["'];/g)
  expect(accountingImports).toEqual(['import { prepareLessonBomForCourse } from "@/lib/courses/lesson-materials";'])
  expect(source.match(/prepareLessonBomForCourse\(/g)).toHaveLength(1)
  expect(source).toContain('prepareLessonBomForCourse(courseId, rawBom)')
})
