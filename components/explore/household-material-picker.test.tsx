import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HOUSEHOLD_MATERIALS, HOUSEHOLD_MATERIAL_GROUPS, normalizeOwnedMaterialIds } from '@/lib/explore/material-matching'
import { MATERIAL_SECTIONS } from '@/lib/explore/material-groups'
import { HouseholdMaterialPicker } from './household-material-picker'

function Harness({ initial = [] }: { initial?: string[] }) {
  const [selected, setSelected] = useState(initial)
  return <><HouseholdMaterialPicker selectedIds={selected} onChange={(ids) => setSelected(normalizeOwnedMaterialIds(ids))} matchedCount={0} /><output data-testid="selected-ids">{JSON.stringify(selected)}</output></>
}

async function openPicker() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '更多材料' }))
  return { user, dialog: screen.getByRole('dialog', { name: '选择家里已有的材料' }) }
}

describe('HouseholdMaterialPicker grouped materials', () => {
  it('starts with a small common-material list and closed categories, without specification checklists', async () => {
    render(<Harness />)
    const { dialog } = await openPicker()
    const all = within(dialog).getByRole('group', { name: '全部材料' })
    const common = within(all).getByRole('group', { name: '常用材料' })
    expect(within(common).getAllByRole('button').length).toBeGreaterThan(0)
    expect(within(all).getAllByRole('button').length).toBeLessThanOrEqual(30)
    expect(dialog.querySelectorAll('details[open]')).toHaveLength(0)
    for (const section of MATERIAL_SECTIONS) expect(within(dialog).getByText(section.label)).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('核对已选材料规格')).not.toBeInTheDocument()
    expect(within(dialog).getByText('选择家里有的材料，具体要求在项目里查看。')).toBeInTheDocument()
  })

  it('restores several old specifications as one category and removes them together', async () => {
    const coins = HOUSEHOLD_MATERIALS.filter(({ label }) => ['1元硬币', '1角硬币'].includes(label))
    render(<Harness initial={coins.map(({ id }) => id)} />)
    expect(screen.getByTestId('household-material-picker')).toHaveTextContent('已选 1 样')
    const { user, dialog } = await openPicker()
    const common = within(dialog).getByRole('group', { name: '常用材料' })
    expect(within(common).getByRole('button', { name: '硬币' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByRole('button', { name: '1元硬币' })).not.toBeInTheDocument()
    await user.click(within(common).getByRole('button', { name: '硬币' }))
    expect(screen.getByTestId('selected-ids')).toHaveTextContent('[]')
  })

  it('offers one bottle category and preserves the selected state across searching', async () => {
    const group = HOUSEHOLD_MATERIAL_GROUPS.find(({ label }) => label === '瓶子')!
    render(<Harness />)
    const { user, dialog } = await openPicker()
    const all = within(dialog).getByRole('group', { name: '全部材料' })
    await user.click(within(all).getByRole('button', { name: '瓶子' }))
    expect(screen.getByTestId('selected-ids')).toHaveTextContent(JSON.stringify([group.id]))
    fireEvent.change(within(dialog).getByRole('textbox', { name: '搜索材料' }), { target: { value: '瓶装清水' } })
    const results = within(dialog).getByRole('group', { name: '搜索结果' })
    expect(within(results).getAllByRole('button', { name: '瓶子' })).toHaveLength(1)
    expect(within(results).getByRole('button', { name: '瓶子' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).queryByText('常用材料')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: '瓶装清水' })).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByRole('textbox', { name: '搜索材料' }), { target: { value: '' } })
    expect(within(dialog).getByRole('group', { name: '常用材料' })).toBeInTheDocument()
  })

  it('lets a non-featured restored selection be removed from its category', async () => {
    const material = HOUSEHOLD_MATERIAL_GROUPS.find((group) => !group.featured && !group.common)!
    const section = MATERIAL_SECTIONS.find(({ id }) => id === material.section)!
    render(<Harness initial={[material.id]} />)
    const { user, dialog } = await openPicker()
    expect(within(dialog).queryByRole('button', { name: material.label })).not.toBeInTheDocument()
    await user.click(within(dialog).getByText(section.label))
    const category = within(dialog).getByRole('group', { name: section.label })
    const option = within(category).getByRole('button', { name: material.label })
    expect(option).toHaveAttribute('aria-pressed', 'true')
    await user.click(option)
    expect(screen.getByTestId('selected-ids')).toHaveTextContent('[]')
  })

  it('makes every material available in a category without showing long usage notes', async () => {
    render(<Harness />)
    const { user, dialog } = await openPicker()
    for (const section of MATERIAL_SECTIONS) {
      await user.click(within(dialog).getByText(section.label))
      const category = within(dialog).getByRole('group', { name: section.label })
      const expected = HOUSEHOLD_MATERIAL_GROUPS.filter((group) => group.section === section.id)
      expect(within(category).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(expected.map(({ label }) => label))
      expect(category).toHaveClass('auto-rows-max', 'items-start')
      await user.click(within(dialog).getByText(section.label))
      expect(within(dialog).queryByRole('group', { name: section.label })).not.toBeInTheDocument()
    }
    const materialWithNote = HOUSEHOLD_MATERIALS.find(({ description }) => description)!
    expect(dialog).not.toHaveTextContent(materialWithNote.description!)
  })

  it('returns focus to the trigger after closing and reopens a concise default view', async () => {
    render(<Harness />)
    const { user, dialog } = await openPicker()
    await user.click(within(dialog).getByText(MATERIAL_SECTIONS[0].label))
    await user.click(within(dialog).getByRole('button', { name: '选好了，查看项目' }))
    expect(screen.getByRole('button', { name: '更多材料' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: '更多材料' }))
    expect(screen.getByRole('dialog').querySelectorAll('details[open]')).toHaveLength(0)
  })
})

it('keeps five shortcuts and exposes selected overflow materials for removal', async () => {
  const cup = HOUSEHOLD_MATERIAL_GROUPS.find(({ label }) => label === '硬币')!
  render(<Harness initial={[cup.id]} />)
  const common = screen.getByRole('group', { name: '常见材料' })
  expect(within(common).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(['纸巾', '气球', '吸管', '水', '纸杯'])
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '移除硬币' }))
  expect(screen.getByTestId('selected-ids')).toHaveTextContent('[]')
  const { dialog } = await openPicker()
  await user.type(within(dialog).getByRole('textbox', { name: '搜索材料' }), '硬币')
  await user.click(within(dialog).getByRole('button', { name: '硬币' }))
  await user.click(within(dialog).getByRole('button', { name: '选好了，查看项目' }))
  expect(screen.getByRole('button', { name: '移除硬币' })).toBeInTheDocument()
})
