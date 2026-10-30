import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProjectMaterials } from './project-materials'

const flags = vi.hoisted(() => ({ visible: true }))
vi.mock('@/lib/store/config', () => ({ isStoreCatalogVisible: () => flags.visible }))
vi.mock('@/components/ui/optimized-image', () => ({ OptimizedImage: () => null }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a> }))

const materials = ['配套木质鹰头、双翼身体板', '配套两片交叉支架板']
const kitMatches: NonNullable<ComponentProps<typeof ProjectMaterials>['kitMatches']> = [{
  kit: { id: 'kit-2', slug: 'grade2', revision: 1, status: 'published', name: '2026二年级16件套+说明书', kind: 'material_pack',
    cover_url: '/grade2.jpg', gallery_urls: [], materials: [], catalog: [], preparation_note: '' },
  confirmed: false, preparationStatus: 'unknown', extras: [], offers: [],
  linkedOffers: [{ id: 'grade2', productId: 'science-pack', productName: '科学实验套装', name: '小学二年级', priceCents: 1000 }],
}]
const props = { materials, kitMatches, projectTitle: '平衡鹰', idSuffix: 'mobile' }

beforeEach(() => { flags.visible = true })

it('leads with the exact kit and preserves folded parts in the server HTML', () => {
  const { container } = render(<ProjectMaterials {...props} />)
  const link = screen.getByRole('link', { name: /科学实验套装.*小学二年级/ })
  expect(link).toHaveAttribute('href', '/store/products/science-pack?variant=grade2')
  const details = container.querySelector('details')!
  expect(details).not.toHaveAttribute('open')
  expect(details).toHaveTextContent(materials[0])
  expect(details).toHaveTextContent(materials[1])
  const html = renderToStaticMarkup(<ProjectMaterials {...props} />)
  expect(html).toContain(materials[0])
  expect(html).toContain(materials[1])
})

it('keeps daily supplies, explicit self-preparation and preparation requirements outside the fold', () => {
  render(<ProjectMaterials {...props} materials={[...materials, '清水150毫升', '剪刀（自备）']}
    preparationNotes={['剪刀由成人使用。']} />)
  for (const text of ['水', '剪刀', '剪刀由成人使用。']) {
    expect(screen.getByText(text).closest('details')).toBeNull()
  }
  expect(screen.getByText('150毫升')).toBeVisible()
})

it('leaves the full list visible when offers disappear or the catalog closes', () => {
  const { container, rerender } = render(<ProjectMaterials {...props} kitMatches={[]} />)
  expect(container.querySelector('details')).toBeNull()
  expect(screen.getByText(materials[0])).toBeVisible()
  flags.visible = false
  rerender(<ProjectMaterials {...props} />)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(container.querySelector('details')).toBeNull()
  expect(screen.getByText(materials[1])).toBeVisible()
})

it('does not treat a general materials assortment as a complete project kit', () => {
  const match = kitMatches![0]
  const { container } = render(<ProjectMaterials {...props} kitMatches={[{ ...match,
    kit: { ...match.kit, kind: 'general_materials' }, confirmed: true, preparationStatus: 'extras', extras: ['清水'],
  }]} />)
  expect(container.querySelector('details')).toBeNull()
  expect(screen.getByText('还需自备：清水')).toBeVisible()
})

it('keeps explicit self-preparation visible even for a confirmed complete pack', () => {
  const match = kitMatches![0]
  render(<ProjectMaterials {...props} materials={['木片', '剪刀（自备）']}
    kitMatches={[{ ...match, confirmed: true, preparationStatus: 'ready' }]} />)
  expect(screen.getByText('木片').closest('details')).not.toBeNull()
  expect(screen.getByText('剪刀').closest('details')).toBeNull()
})
