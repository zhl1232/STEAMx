import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderProjectOverview, renderProjectOverviews } from './render-project-overviews.mjs'

test('escapes authored text and preserves every instruction title in order', () => {
  const svg = renderProjectOverview({ id: 1, title: 'A&B <纸>', category: '艺术', overview: { steps: ['画 "图案"', '折叠 & 粘贴', '观察结果'] } })
  assert.ok(svg.includes('A&amp;B &lt;纸&gt;'))
  assert.ok(svg.includes('画 &quot;图案&quot;'))
  assert.ok(svg.indexOf('1. 画') < svg.indexOf('2. 折叠'))
  assert.ok(svg.includes('步骤概览'))
  assert.equal((svg.match(/<circle /g) ?? []).length, 3)
  assert.ok(!svg.includes('<image'))
})

test('requires explicit review for empty, overly long, or unbounded outlines', () => {
  const base = { id: 1, title: '项目', category: '工程' }
  for (const steps of [[], [''], ['字'.repeat(23)], Array(9).fill('动作')]) {
    assert.throws(() => renderProjectOverview({ ...base, overview: { steps } }))
  }
})

test('all checked-in overviews exactly match the reviewed project labels', async () => {
  assert.ok(await renderProjectOverviews({ check: true }) > 0)
})
