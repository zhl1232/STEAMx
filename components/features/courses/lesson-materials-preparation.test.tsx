import { act, fireEvent, render, screen } from '@testing-library/react'
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

it('server render shows plain-language headline and no engineering terms', () => {
  const html = renderToStaticMarkup(<LessonMaterialsPreparation courseId={5} entries={entries} partCount={partCount} />)
  expect(html).toContain('还差 2 种、共 3 块')
  expect(html).toContain('需要补买')
  expect(html).toContain('可选（底板等）')
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
  const html = renderToStaticMarkup(<LessonMaterialsPreparation courseId={5} entries={plates} partCount={count + (reserveSmallPlates ? 2 : 0)} />)

  expect(html).toContain('用你的套装可以搭完')
  expect(html).not.toContain('需要补买')
  expect(html).toContain('可以用其它颜色或零件代替')
  expect(html).toContain('大的薄板可以拼成小的')
  expect(html).toContain(detail)
  const content = document.createElement('div')
  content.innerHTML = html
  for (const term of ['LDraw', 'Rebrickable', '51262', '4672', '6490']) expect(content.textContent).not.toContain(term)
})

it('steppers recalculate instantly and persist to localStorage', async () => {
  render(<LessonMaterialsPreparation courseId={5} entries={entries} partCount={partCount} />)
  expect(await screen.findByText('还差 2 种、共 3 块')).toBeTruthy()
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
  expect(screen.getByText('先在下面填上你有几套积木')).toBeTruthy()
  expect((screen.getByRole('button', { name: '大颗粒基础套装 9090减少一套' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getAllByLabelText(/套数$/)).toHaveLength(6)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '管道套装 45026增加一套' }))
  })
  expect(screen.getByLabelText('管道套装 45026套数').textContent).toBe('1')
  expect(screen.queryByText('先在下面填上你有几套积木')).toBeNull()
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
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '大颗粒基础套装 9090增加一套' }))
  })
  expect(JSON.parse(window.localStorage.getItem(kitCountsStorageKey(courseId))!)).toEqual({
    '9090-2': 2, '9076-1': 1, '45026-1': 0, '9206-1': 0, '45002-1': courseId === 6 ? 1 : 0, '9656-1': courseId === 7 ? 1 : 0,
  })
})


it('updates full and step row colors from the selected kit and restores model colors when removed', async () => {
  const mechanical = [entry('28331.dat', 7, 1, '短连杆', '浅灰色')]
  render(<LessonMaterialsPreparation courseId={6} entries={mechanical} partCount={1}>
    <MaterialPartTable entries={mechanical} />
    <MaterialPartTable entries={mechanical} />
  </LessonMaterialsPreparation>)
  expect(await screen.findAllByText('深灰色短连杆')).toHaveLength(2)
  expect(screen.queryByText('可以用其它颜色或零件代替')).toBeNull()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '科技机械套装 45002减少一套' }))
  })
  expect(screen.getAllByText('浅灰色短连杆').length).toBeGreaterThanOrEqual(2)
  expect(screen.queryByText('深灰色短连杆')).toBeNull()
})

it('9206 can be selected, covers its exhaust pipe, and persists its count', async () => {
  const exhaust = [entry('4433c01.dat', 7, 2, '排气管', '浅灰色')]
  render(<LessonMaterialsPreparation courseId={5} entries={exhaust} partCount={2} />)
  expect(screen.getByLabelText('科技机械套装 9206套数').textContent).toBe('0')
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '科技机械套装 9206增加一套' }))
  })
  expect(screen.getByText('用你的套装可以搭完')).toBeTruthy()
  expect(JSON.parse(window.localStorage.getItem(kitCountsStorageKey(5))!)).toMatchObject({ '9206-1': 1 })
})
