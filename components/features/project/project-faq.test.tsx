import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectFaq } from './project-faq'
import { LED_CARD_REFERENCE_NOTE } from '@/lib/project/led-card'

describe('ProjectFaq', () => {
  it('keeps FAQ collapsed and toggles answers without the removed reference block', async () => {
    const items = [{ question: '为什么串联电阻？', answer: '用于限流。' }]
    render(<ProjectFaq items={items} projectId={149} />)
    expect(screen.getByText(items[0].question)).toBeVisible()
    expect(screen.getByText(items[0].answer)).not.toBeVisible()
    await userEvent.click(screen.getByText(items[0].question))
    expect(screen.getByText(items[0].answer)).toBeVisible()
    expect(screen.queryByText(LED_CARD_REFERENCE_NOTE, { exact: false })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('link', { hidden: true })).toHaveLength(0)
    expect(screen.getByText(items[0].question).closest('details')).toHaveAttribute('open')
  })
})
