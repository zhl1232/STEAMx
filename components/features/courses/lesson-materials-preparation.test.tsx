import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it } from 'vitest'
import type { LdrawBomEntry } from '@/lib/utils/ldraw-bom'
import { kitCountsStorageKey } from '@/lib/courses/lesson-material-preferences'
import { LessonMaterialsPreparation, MaterialPartTable } from './lesson-materials-preparation'

const entry = (partId: string, colorCode: number, count: number, partName: string, colorName = '红色'): LdrawBomEntry => ({
  partId,
  colorCode,
  count,
  partName,
  partDescription: '',
  colorName,
  colorHex: '#C91A09',
})
const entries = [
  entry('3011.dat', 4, 30, '2×4 积木'),
  entry('4196.dat', 4, 4, '6×12 薄板'),
  entry('4268.dat', 2, 1, '24×24 底板', '绿色'),
  entry('31196c01.dat', 1, 1, 'Duplo Toolo Cockpit', '蓝色'),
]
const partCount = entries.reduce((n, e) => n + e.count, 0)

beforeEach(() => window.localStorage.clear())

async function openKitEditor() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '调整套装' }))
  })
}

it('server render shows plain-language headline and no engineering terms', () => {
  const html = renderToStaticMarkup(<LessonMaterialsPreparation courseId={5} entries={entries} partCount={partCount}><MaterialPartTable entries={entries} showAvailability /></LessonMaterialsPreparation>)
  expect(html).toContain('还差 2 种、共 3 块')
  expect(html).toContain('还缺 2 块')
  expect(html).toContain('可选，缺 1 块')
  expect(html).not.toContain('套装里没有的零件')
  expect(html).toContain('Toolo 座舱')
  for (const term of ['requiredMissing', '.dat', 'LDraw', '对照模型确认']) expect(html).not.toContain(term)
  expect(renderToStaticMarkup(<LessonMaterialsPreparation courseId={8} entries={entries} partCount={partCount} />)).toBe('')
})

it.each([
  { count: 1, reserveSmallPlates: false, detail: '用 2 块亮绿色 4×8 薄板代替' },
  { count: 2, reserveSmallPlates: true, detail: '用 1 块亮绿色 8×16 薄板代替' },
  { count: 2, reserveSmallPlates: false, detail: '用 2 块亮绿色 4×8 薄板、1 块亮绿色 8×16 薄板代替' },
])('explains area substitutions in Chinese: $detail', ({ count, reserveSmallPlates, detail }) => {
  const plates = [{ ...entry('51262.dat', 71, count, '8×8 薄板', '浅蓝灰色'), structural: true }]
  if (reserveSmallPlates) plates.push({ ...entry('4672a.dat', 10, 2, '4×8 薄板', '亮绿色'), structural: true })
  const html = renderToStaticMarkup(<LessonMaterialsPreparation courseId={5} entries={plates} partCount={count + (reserveSmallPlates ? 2 : 0)}><MaterialPartTable entries={plates} showAvailability /></LessonMaterialsPreparation>)

  expect(html).toContain('所选套装的零件够用')
  expect(html).not.toContain('需要补买')
  expect(html).not.toContain("可替代")
  expect(html).toContain(`需 ${count} 块`)
  expect(html).toContain(detail)
  const content = document.createElement('div')
  content.innerHTML = html
  for (const term of ['LDraw', 'Rebrickable', '51262', '4672', '6490']) expect(content.textContent).not.toContain(term)
})

it('steppers recalculate instantly and persist to localStorage', async () => {
  render(<LessonMaterialsPreparation courseId={5} entries={entries} partCount={partCount} />)
  expect(await screen.findByText('还差 2 种、共 3 块')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '大颗粒基础套装 9090增加一套' })).toBeNull()
  await openKitEditor()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '大颗粒基础套装 9090增加一套' }))
  })
  expect(screen.getByText('还差 1 种、共 1 块')).toBeTruthy()
  expect(JSON.parse(window.localStorage.getItem(kitCountsStorageKey(5))!)).toMatchObject({ '9090-2': 2, '9076-1': 1 })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '大颗粒基础套装 9090减少一套' }))
    fireEvent.click(screen.getByRole('button', { name: '大颗粒基础套装 9090减少一套' }))
    fireEvent.click(screen.getByRole('button', { name: '管道实验套装 9076减少一套' }))
  })
  expect(screen.getByText('先选择你有的套装')).toBeTruthy()
  expect((screen.getByRole('button', { name: '大颗粒基础套装 9090减少一套' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getAllByLabelText(/套数$/)).toHaveLength(6)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '管道套装 45026增加一套' }))
  })
  expect(screen.getByLabelText('管道套装 45026套数').textContent).toBe('1')
  expect(screen.queryByText('先选择你有的套装')).toBeNull()
  expect(JSON.parse(window.localStorage.getItem(kitCountsStorageKey(5))!)).toMatchObject({ '45026-1': 1 })
})

it('restores saved counts after mount', async () => {
  window.localStorage.setItem(kitCountsStorageKey(5), JSON.stringify({ '9090-2': 2, '9076-1': 0, '45002-1': 0, '9656-1': 0 }))
  render(<LessonMaterialsPreparation courseId={5} entries={entries} partCount={partCount} />)
  expect(await screen.findByText('还差 1 种、共 1 块')).toBeTruthy()
  expect(screen.getByLabelText('管道套装 45026套数').textContent).toBe('0')
  expect(screen.getByLabelText('科技机械套装 9206套数').textContent).toBe('0')
})


it.each([6, 7])('course %s starts with its mechanical kit plus both base kits', async (courseId) => {
  render(<LessonMaterialsPreparation courseId={courseId} entries={[]} partCount={0} />)
  await openKitEditor()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '大颗粒基础套装 9090增加一套' }))
  })
  expect(JSON.parse(window.localStorage.getItem(kitCountsStorageKey(courseId))!)).toEqual({
    '9090-2': 2, '9076-1': 1, '45026-1': 0, '9206-1': 0, '45002-1': courseId === 6 ? 1 : 0, '9656-1': courseId === 7 ? 1 : 0,
  })
})


it('preserves model colors and explains kit recoloring only in the full list', async () => {
  const mechanical = [entry('28331.dat', 7, 1, '短连杆', '浅灰色')]
  render(<LessonMaterialsPreparation courseId={6} entries={mechanical} partCount={1}>
    <MaterialPartTable entries={mechanical} showAvailability />
    <MaterialPartTable entries={mechanical} />
  </LessonMaterialsPreparation>)
  expect(await screen.findAllByText('浅灰色短连杆')).toHaveLength(2)
  expect(screen.queryByText(/可替代/)).toBeNull()
  expect(screen.getByText('可以用 深灰色 1 块替代')).toBeTruthy()
  expect(screen.getByRole('img', { name: '已备齐' })).toBeTruthy()
  expect(screen.getByText('×1')).toBeTruthy()
  expect(screen.getByText('需 1 块')).toBeTruthy()
  await openKitEditor()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '科技机械套装 45002减少一套' }))
  })
  expect(screen.getAllByText('浅灰色短连杆').length).toBeGreaterThanOrEqual(2)
  expect(screen.queryByText('深灰色短连杆')).toBeNull()
  expect(screen.queryByText(/可替代/)).toBeNull()
  expect(screen.getAllByText('还缺 1 块')).toHaveLength(1)
})

it('reserves the red screw brick and shows exact stock, substitutions and shortage separately', async () => {
  const screws = [
    entry('76057.dat', 7, 4, '2×4 螺丝积木', '浅灰色'),
    entry('76057.dat', 14, 4, '2×4 螺丝积木', '黄色'),
    entry('76057.dat', 4, 1, '2×4 螺丝积木', '红色'),
  ]
  render(<LessonMaterialsPreparation courseId={6} entries={screws} partCount={9}>
    <MaterialPartTable entries={screws} showAvailability />
  </LessonMaterialsPreparation>)
  const row = (name: string) => within(screen.getByText(name).closest('li')!)
  expect(row('红色2×4 螺丝积木').getByText('已备齐')).toBeTruthy()
  expect(row('红色2×4 螺丝积木').queryByText(/还缺|可替代/)).toBeNull()
  const yellow = row('黄色2×4 螺丝积木')
  expect(yellow.getByText('同色已有 1 块')).toBeTruthy()
  expect(yellow.queryByText(/可替代/)).toBeNull()
  expect(yellow.getByText('可以用 深灰色 1 块替代')).toBeTruthy()
  expect(yellow.queryByRole('img', { name: '已备齐' })).toBeNull()
  expect(yellow.getByText('还缺 2 块')).toBeTruthy()
  expect(row('浅灰色2×4 螺丝积木').getByText('可以用 深灰色 4 块替代')).toBeTruthy()
  expect(row('浅灰色2×4 螺丝积木').getByRole('img', { name: '已备齐' })).toBeTruthy()
  const yellowRow = screen.getByText('黄色2×4 螺丝积木').closest('li')!
  const images = yellowRow.querySelectorAll('img')
  expect(images).toHaveLength(1)

  await openKitEditor()
  fireEvent.click(screen.getByRole('button', { name: '科技机械套装 45002增加一套' }))
  expect(screen.queryByText(/还缺/)).toBeNull()
  expect(row('黄色2×4 螺丝积木').getByText('同色已有 2 块')).toBeTruthy()
  expect(row('黄色2×4 螺丝积木').getByText('可以用 深灰色 2 块替代')).toBeTruthy()
})

it('identifies a different-size replacement without reusing the requested shape image', () => {
  const arches = [entry('98223b.dat', 4, 1, '2×4 弧顶积木')]
  render(<LessonMaterialsPreparation courseId={5} entries={arches} partCount={1}>
    <MaterialPartTable entries={arches} showAvailability />
  </LessonMaterialsPreparation>)
  const replacement = screen.getByText('可以用 不同尺寸的红色2×4×2 弧顶积木 1 块替代')
  expect(replacement.textContent).toContain('不同尺寸')
  // Replacement instructions are text-only, including when the shape differs.
  expect(replacement.querySelector('img')).toBeNull()
  expect(screen.getByRole('img', { name: '已备齐' })).toBeTruthy()
})

it('9206 can be selected, covers its exhaust pipe, and persists its count', async () => {
  const exhaust = [entry('4433c01.dat', 7, 2, '排气管', '浅灰色')]
  render(<LessonMaterialsPreparation courseId={5} entries={exhaust} partCount={2} />)
  expect(screen.getByLabelText('科技机械套装 9206套数').textContent).toBe('0')
  await openKitEditor()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '科技机械套装 9206增加一套' }))
  })
  expect(screen.getByText('所选套装的零件够用')).toBeTruthy()
  expect(JSON.parse(window.localStorage.getItem(kitCountsStorageKey(5))!)).toMatchObject({ '9206-1': 1 })
})

it('shows partial substitutions and the remaining shortage together only in the full list', () => {
  const full = [entry('3011.dat', 4, 150, '2×4 积木')]
  const step = [{ ...full[0], count: 2 }]
  render(<LessonMaterialsPreparation courseId={5} entries={full} partCount={150}>
    <section aria-label="完整清单"><MaterialPartTable entries={full} showAvailability /></section>
    <section aria-label="本步零件"><MaterialPartTable entries={step} /></section>
  </LessonMaterialsPreparation>)
  const fullList = within(screen.getByRole('region', { name: '完整清单' }))
  expect(fullList.getByText('需 150 块')).toBeTruthy()
  expect(fullList.getByText('同色已有 24 块')).toBeTruthy()
  const replacementCount = fullList.getAllByText(/^可以用 /).reduce((total, element) => total + [...element.textContent!.matchAll(/(\d+) 块/g)].reduce((sum, match) => sum + Number(match[1]), 0), 0)
  expect(replacementCount).toBe(116)
  expect(fullList.getByText('还缺 10 块')).toBeTruthy()
  const stepList = within(screen.getByRole('region', { name: '本步零件' }))
  expect(stepList.getByText('×2')).toBeTruthy()
  expect(stepList.queryByText(/可替代|还缺|已备齐|同色已有/)).toBeNull()
})

it('distinguishes optional baseplates from unknown parts without promising a replacement', () => {
  const materials = [
    entry('4268.dat', 2, 1, '24×24 底板', '绿色'),
    entry('unlisted-test-part.dat', 4, 2, '特殊零件'),
  ]
  render(<LessonMaterialsPreparation courseId={5} entries={materials} partCount={3}>
    <MaterialPartTable entries={materials} showAvailability />
  </LessonMaterialsPreparation>)
  expect(screen.getByRole('status', { name: '' }).textContent).toContain('还有 1 种零件需确认')
  expect(screen.getByText('可选，缺 1 块')).toBeTruthy()
  expect(screen.getByText('需确认 2 块')).toBeTruthy()
  expect(screen.getByText('套装清单未收录')).toBeTruthy()
  expect(screen.queryByText('所选套装的零件够用')).toBeNull()
  expect(screen.queryByText(/自由搭一个代替/)).toBeNull()
  expect(screen.queryByText(/还缺/)).toBeNull()
})

it('keeps a known shortage and a separate unknown warning in the summary', () => {
  const materials = [entry('3011.dat', 4, 150, '2×4 积木'), entry('unlisted-test-part.dat', 4, 2, '特殊零件')]
  render(<LessonMaterialsPreparation courseId={5} entries={materials} partCount={152}>
    <MaterialPartTable entries={materials} showAvailability />
  </LessonMaterialsPreparation>)
  expect(screen.getByRole('status', { name: '' }).textContent).toContain('还差 1 种、共 10 块')
  expect(screen.getByRole('status', { name: '' }).textContent).toContain('另有 1 种零件需确认')
})

it('labels external materials as self-prepared supplies instead of unknown or purchasable bricks', () => {
  const materials = [entry('dev-cord/rotor-left-small-formed.dat', 0, 2, '绳圈', '黑色')]
  render(<LessonMaterialsPreparation courseId={5} entries={materials} partCount={2}>
    <MaterialPartTable entries={materials} showAvailability />
  </LessonMaterialsPreparation>)
  expect(screen.getByText('还有 1 种材料需准备')).toBeTruthy()
  expect(screen.getByText('需自备 2 份')).toBeTruthy()
  expect(screen.getByText('需 2 份')).toBeTruthy()
  expect(screen.queryByText(/需确认|还缺|补买/)).toBeNull()
})

it('shows whole figures without fabricated colors or substitution instructions', () => {
  const figures = [entry('__duplo_child_figure__.dat', 15, 1, '完整小人', '白色')]
  render(<LessonMaterialsPreparation courseId={5} entries={figures} partCount={1}>
    <MaterialPartTable entries={figures} showAvailability />
  </LessonMaterialsPreparation>)
  expect(screen.getByText('完整小人')).toBeTruthy()
  expect(screen.getByText('需 1 个')).toBeTruthy()
  expect(screen.getByText('已备齐')).toBeTruthy()
  expect(screen.queryByText(/白色完整小人|可替代|可以用/)).toBeNull()
})

it('does not claim matching clothing colors for partially covered whole figures', () => {
  const figures = [entry('__duplo_child_figure__.dat', 15, 999, '完整小人', '白色')]
  render(<LessonMaterialsPreparation courseId={5} entries={figures} partCount={999}>
    <MaterialPartTable entries={figures} showAvailability />
  </LessonMaterialsPreparation>)
  expect(screen.getByText(/套装已有 \d+ 个/)).toBeTruthy()
  expect(screen.getByText('服装颜色不限')).toBeTruthy()
  expect(screen.getByText(/还缺 \d+ 个/)).toBeTruthy()
  expect(screen.queryByText(/同色已有/)).toBeNull()
})

it('leaves non-comparison courses and tables without allocation context plain', () => {
  render(<LessonMaterialsPreparation courseId={8} entries={entries} partCount={partCount}>
    <MaterialPartTable entries={entries} showAvailability />
  </LessonMaterialsPreparation>)
  expect(screen.getByText('×30')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.queryByText(/可替代|还缺|已备齐|需确认/)).toBeNull()
})

it('prioritizes shortages, unknown parts and substitutions in the full list without reordering steps or input', () => {
  const materials = [
    entry('28331.dat', 72, 1, '短连杆', '深灰色'),
    entry('4268.dat', 2, 1, '24×24 底板', '绿色'),
    { ...entry('51262.dat', 71, 1, '8×8 薄板', '浅灰色'), structural: true },
    entry('unlisted-test-part.dat', 4, 2, '特殊零件'),
    entry('3011.dat', 4, 999, '2×4 积木'),
  ]
  const originalIds = materials.map((item) => item.partId)
  render(<LessonMaterialsPreparation courseId={6} entries={materials} partCount={1004}>
    <section aria-label="完整清单"><MaterialPartTable entries={materials} showAvailability /></section>
    <section aria-label="本步零件"><MaterialPartTable entries={materials} /></section>
  </LessonMaterialsPreparation>)
  const fullRows = within(screen.getByRole('region', { name: '完整清单' })).getAllByRole('listitem')
  for (const [index, label] of ['还缺', '需确认', '替代', '已备齐', '可选'].entries()) {
    expect(fullRows[index].textContent).toContain(label)
  }
  const stepRows = within(screen.getByRole('region', { name: '本步零件' })).getAllByRole('listitem')
  expect(stepRows.map((row) => row.textContent)).toEqual(materials.map((item) =>
    `${item.colorName}${item.partName}×${item.count}`,
  ))
  expect(materials.map((item) => item.partId)).toEqual(originalIds)
})
