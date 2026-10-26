import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GrowthReviews } from './growth-reviews'
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
describe('manual growth review controls', () => {
  it('requires an explicit stage and evidence, without default full marks', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 9, type: 'completion', hash: 'a'.repeat(32), evidence: { notes: 'A failed experiment with comparison' }, reviews: [] }] }) })
    render(<GrowthReviews />)
    fireEvent.click(screen.getByText('加载 / 刷新'))
    await screen.findByText('A failed experiment with comparison')
    expect(screen.getByText('保存价值审核')).toBeDisabled()
    expect(screen.getAllByRole('checkbox').every(box => !(box as HTMLInputElement).checked)).toBe(true)
    fireEvent.click(screen.getByLabelText('首次真实过程 · 40 XP'))
    expect(screen.getByText('保存价值审核')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('审核依据 9'), { target: { value: 'Observed attempt recorded in the attached evidence' } })
    fireEvent.click(screen.getByText('保存价值审核'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/growth-reviews', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"stages":["process"]') })))
  })
})
