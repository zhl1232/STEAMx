import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SpeciesCardCover } from './species-list-load-more'

describe('SpeciesCardCover', () => {
  it('keeps the cover hidden until it loads successfully', () => {
    render(
      <SpeciesCardCover
        imageUrl="/insects/images/acanthacorydalis-orientalis.jpg"
        speciesName="东方巨齿蛉"
        topicKey="insects"
      />,
    )

    const image = screen.getByAltText('东方巨齿蛉')
    expect(image).toHaveClass('opacity-0')

    fireEvent.load(image)

    expect(image).toHaveClass('opacity-100')
  })

  it('removes a failed cover and shows the empty state', () => {
    render(
      <SpeciesCardCover
        imageUrl="/insects/images/missing.jpg"
        speciesName="东方巨齿蛉"
        topicKey="insects"
      />,
    )

    fireEvent.error(screen.getByAltText('东方巨齿蛉'))

    expect(screen.queryByAltText('东方巨齿蛉')).not.toBeInTheDocument()
    expect(screen.getByText('暂无图片')).toBeInTheDocument()
  })

  it('shows the empty state when the species has no cover URL', () => {
    render(
      <SpeciesCardCover
        imageUrl={null}
        speciesName="东方巨齿蛉"
        topicKey="insects"
      />,
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('暂无图片')).toBeInTheDocument()
  })
})
