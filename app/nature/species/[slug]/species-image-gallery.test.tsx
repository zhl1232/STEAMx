import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SpeciesImageGallery } from './species-image-gallery'

describe('SpeciesImageGallery', () => {
  it('shows a species placeholder when no image is available', () => {
    render(
      <SpeciesImageGallery
        speciesName="银杏"
        scientificName="Ginkgo biloba"
        speciesNamePinyin="yin xing"
        topicKey="plants"
        imageUrls={[]}
      />,
    )

    expect(screen.getByText('暂无图片')).toBeInTheDocument()
    expect(screen.getByText('银杏')).toBeInTheDocument()
    expect(screen.getByText('Ginkgo biloba')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('keeps the placeholder visible until the image loads successfully', () => {
    render(
      <SpeciesImageGallery
        speciesName="东方巨齿蛉"
        imageUrls={['/insects/images/working.jpg']}
      />,
    )

    const image = screen.getByAltText('东方巨齿蛉')
    expect(image).toHaveClass('opacity-0')

    fireEvent.load(image)

    expect(image).toHaveClass('opacity-100')
  })

  it('removes a failed image and advances to the next available image', () => {
    render(
      <SpeciesImageGallery
        speciesName="东方巨齿蛉"
        imageUrls={[
          '/insects/images/missing.jpg',
          '/insects/images/working-2.jpg',
          '/insects/images/working-3.jpg',
        ]}
      />,
    )

    fireEvent.error(screen.getByAltText('东方巨齿蛉'))

    const activeImageSrc = screen.getByAltText('东方巨齿蛉').getAttribute('src') ?? ''
    expect(decodeURIComponent(activeImageSrc)).toContain('/insects/images/working-2.jpg')
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.queryByAltText('东方巨齿蛉 图片 3')).not.toBeInTheDocument()
  })

  it('returns to the placeholder when every image fails', () => {
    render(
      <SpeciesImageGallery
        speciesName="东方巨齿蛉"
        imageUrls={[
          '/insects/images/missing-1.jpg',
          '/insects/images/missing-2.jpg',
        ]}
      />,
    )

    fireEvent.error(screen.getByAltText('东方巨齿蛉'))
    fireEvent.error(screen.getByAltText('东方巨齿蛉'))

    expect(screen.getByText('暂无图片')).toBeInTheDocument()
    expect(screen.queryByAltText('东方巨齿蛉')).not.toBeInTheDocument()
  })
})
