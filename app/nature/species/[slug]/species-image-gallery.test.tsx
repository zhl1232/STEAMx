import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SpeciesImageGallery } from './species-image-gallery'

describe('SpeciesImageGallery', () => {
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
})
