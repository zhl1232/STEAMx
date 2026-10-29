import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExploreSearchOverlay } from './explore-search-overlay'

function SearchHarness({ onSubmit = vi.fn() }: { onSubmit?: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>打开搜索</button>
      <button>背景分类</button>
      <ExploreSearchOverlay open={open} initialValue="" onClose={() => setOpen(false)} onSubmit={onSubmit} />
    </>
  )
}

beforeEach(() => localStorage.clear())

describe('ExploreSearchOverlay', () => {
  it('keeps keyboard focus in search and restores the entry on Escape', async () => {
    const user = userEvent.setup()
    render(<SearchHarness />)
    const trigger = screen.getByRole('button', { name: '打开搜索' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: '搜索项目' })
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus())

    for (let i = 0; i < 12; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('preserves composition handling and remembers submitted searches', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SearchHarness onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: '打开搜索' }))
    const input = screen.getByRole('searchbox')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '磁铁' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input)
    fireEvent.submit(screen.getByRole('search'))
    expect(onSubmit).toHaveBeenCalledWith('磁铁')
    expect(JSON.parse(localStorage.getItem('explore-recent-searches')!)).toEqual(['磁铁'])
  })
})
