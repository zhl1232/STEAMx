import { act, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it } from 'vitest'
import type { LdrawBomEntry } from '@/lib/utils/ldraw-bom'
import { kitCountsStorageKey } from '@/lib/courses/lesson-material-preferences'
import { LessonMaterialsPreparation } from './lesson-materials-preparation'

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
  expect(html).toContain('还差 1 种、共 2 块')
  expect(html).toContain('需要补买')
  expect(html).toContain('可选（底板等）')
  expect(html).toContain('套装里没有的零件')
  expect(html).toContain('Toolo 座舱')
  for (const term of ['requiredMissing', '.dat', 'LDraw', '对照模型确认']) expect(html).not.toContain(term)
  expect(renderToStaticMarkup(<LessonMaterialsPreparation courseId={8} entries={entries} partCount={partCount} />)).toBe('')
})

it('steppers recalculate instantly and persist to localStorage', async () => {
  render(<LessonMaterialsPreparation courseId={5} entries={entries} partCount={partCount} />)
  expect(await screen.findByText('还差 1 种、共 2 块')).toBeTruthy()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '大颗粒基础套装增加一套' }))
  })
  expect(screen.getByText('用你的套装可以搭完')).toBeTruthy()
  expect(JSON.parse(window.localStorage.getItem(kitCountsStorageKey(5))!)).toMatchObject({ '9090-2': 2, '9076-1': 1 })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '大颗粒基础套装减少一套' }))
    fireEvent.click(screen.getByRole('button', { name: '大颗粒基础套装减少一套' }))
    fireEvent.click(screen.getByRole('button', { name: '管道实验套装减少一套' }))
  })
  expect(screen.getByText('先在下面填上你有几套积木')).toBeTruthy()
  expect((screen.getByRole('button', { name: '大颗粒基础套装减少一套' }) as HTMLButtonElement).disabled).toBe(true)
})

it('restores saved counts after mount', async () => {
  window.localStorage.setItem(kitCountsStorageKey(5), JSON.stringify({ '9090-2': 2, '9076-1': 0, '45002-1': 0, '9656-1': 0 }))
  render(<LessonMaterialsPreparation courseId={5} entries={entries} partCount={partCount} />)
  expect(await screen.findByText('用你的套装可以搭完')).toBeTruthy()
})
