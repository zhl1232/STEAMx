import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PublicClassification } from '@/lib/content-classification/types'
import { ContentClassification } from './content-classification'

const sampleClassification: PublicClassification = {
  recommendedMinAge: 8,
  recommendedMaxAge: null,
  ageLabel: '8 岁起',
  difficultyBand: 'intermediate',
  difficultyLabel: '进阶',
  supportLevel: 'guided',
  supportLabel: '建议成人陪同',
  educationStage: 'primary',
  educationStageLabel: '小学',
  status: 'reviewed',
}

describe('ContentClassification', () => {
  it('returns null when classification is missing', () => {
    const { container } = render(<ContentClassification classification={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders semantic chips with unified rounded-xs geometry and icons', () => {
    render(<ContentClassification classification={sampleClassification} />)

    const group = screen.getByLabelText('适龄 8 岁起，难度 进阶，建议成人陪同')
    expect(group).toBeInTheDocument()

    expect(screen.getByText('8 岁起')).toBeInTheDocument()
    expect(screen.getByText('进阶')).toBeInTheDocument()
    expect(screen.getByText('建议成人陪同')).toBeInTheDocument()
  })

  it('renders summary variant for compact text rows', () => {
    render(<ContentClassification classification={sampleClassification} variant="summary" />)

    const summary = screen.getByLabelText('适龄 8 岁起，难度 进阶，建议成人陪同')
    expect(summary).toHaveTextContent('8 岁起 · 进阶 · 建议成人陪同')
  })

  it('renders beginner and independent badges with correct semantic text', () => {
    const beginnerClassification: PublicClassification = {
      ...sampleClassification,
      recommendedMinAge: 6,
      ageLabel: '6 岁起',
      difficultyBand: 'beginner',
      difficultyLabel: '入门',
      supportLevel: 'independent',
      supportLabel: '可独立完成',
    }

    render(<ContentClassification classification={beginnerClassification} />)

    expect(screen.getByText('6 岁起')).toBeInTheDocument()
    expect(screen.getByText('入门')).toBeInTheDocument()
    expect(screen.getByText('可独立完成')).toBeInTheDocument()
  })

  it('renders challenge and adult_required badges with correct semantic text', () => {
    const challengeClassification: PublicClassification = {
      ...sampleClassification,
      recommendedMinAge: 12,
      ageLabel: '12 岁起',
      difficultyBand: 'challenge',
      difficultyLabel: '挑战',
      supportLevel: 'adult_required',
      supportLabel: '需成人协助',
    }

    render(<ContentClassification classification={challengeClassification} />)

    expect(screen.getByText('12 岁起')).toBeInTheDocument()
    expect(screen.getByText('挑战')).toBeInTheDocument()
    expect(screen.getByText('需成人协助')).toBeInTheDocument()
  })
})
