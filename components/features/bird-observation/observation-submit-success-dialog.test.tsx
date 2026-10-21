import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/optimized-image', () => ({ OptimizedImage: () => null }))

import { ObservationSubmitSuccessDialog } from './observation-submit-success-dialog'

describe('ObservationSubmitSuccessDialog', () => {
  it('提示审核中，并说明通过后点亮图鉴的物种', () => {
    render(<ObservationSubmitSuccessDialog open onOpenChange={() => {}} observationId={1} speciesName="白头鹎" expectedXp={10} />)
    expect(screen.getByText('已提交，审核中')).toBeInTheDocument()
    expect(screen.getByText('审核通过后点亮图鉴：白头鹎')).toBeInTheDocument()
  })
})
