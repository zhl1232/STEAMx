import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ProjectKitMatches } from './project-kit-matches'

const flags = vi.hoisted(() => ({ visible: true }))
vi.mock('@/lib/store/config', () => ({ isStoreCatalogVisible: () => flags.visible }))
vi.mock('@/components/ui/optimized-image', () => ({ OptimizedImage: ({ src }: {src: string}) => <img src={src} alt="" /> }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a> }))
const matches: ComponentProps<typeof ProjectKitMatches>['matches'] = [{
  kit: { id: 'k1', name: '2026二年级16件套+说明书', cover_url: '/kit-grade2.jpg', kind: 'material_pack', slug: 'grade2', revision: 1, status: 'published', gallery_urls: [], materials: [], catalog: [], preparation_note: '' },
  confirmed: false, preparationStatus: 'unknown', extras: [], offers: [],
  linkedOffers: [{ id: 'v2', productId: 'p1', productName: '科学实验套装', name: '2026二年级16件套+说明书', priceCents: 1000 }],
}]

it('shows the matched image and specification and links directly to that SKU without asserting coverage', () => {
  const { container } = render(<ProjectKitMatches matches={matches} embedded />)
  expect(screen.getByRole('link', { name: /科学实验套装.*小学二年级/ })).toHaveAttribute('href', '/store/products/p1?variant=v2')
  expect(screen.getByText('小学二年级 · 16件套')).toBeVisible()
  expect(screen.queryByText('2026二年级16件套+说明书')).not.toBeInTheDocument()
  expect(container.querySelector('img')).toHaveAttribute('src', '/kit-grade2.jpg')
  expect(screen.queryByText(/全部配齐|包含全部|¥|本站下单/)).not.toBeInTheDocument()
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})

it('preserves genuine extras for general materials', () => {
  render(<ProjectKitMatches matches={[{ ...matches[0], kit: { ...matches[0].kit, kind: 'general_materials' }, confirmed: true, preparationStatus: 'extras', extras: ['清水'] }]} />)
  expect(screen.getByText('还需自备：清水')).toBeVisible()
})

it('does not show unavailable offers or closed catalogs', () => {
  const { container, rerender } = render(<ProjectKitMatches matches={[{ ...matches[0], linkedOffers: [] }]} />)
  expect(container).toBeEmptyDOMElement()
  flags.visible = false
  rerender(<ProjectKitMatches matches={matches} />)
  expect(container).toBeEmptyDOMElement()
  flags.visible = true
})

it.each([
  ['2026幼儿园小班16件套+说明书', '幼儿园小班 · 16件套'],
  ['2026二年级32件套+补充包', '2026二年级32件套+补充包'],
  ['2027二年级16件套+说明书', '2027二年级16件套+说明书'],
])('formats only known imported material-pack specifications: %s', (raw, displayed) => {
  render(<ProjectKitMatches matches={[{ ...matches[0], linkedOffers: [{ ...matches[0].linkedOffers[0], name: raw }] }]} />)
  expect(screen.getByText(displayed)).toBeVisible()
  expect(screen.getByRole('link', { name: /查看材料包/ })).toHaveAttribute('href', '/store/products/p1?variant=v2')
})

it('keeps confirmed self-preparation requirements visible for material packs', () => {
  render(<ProjectKitMatches matches={[{ ...matches[0], confirmed: true, preparationStatus: 'extras', extras: ['剪刀', '清水'] }]} embedded />)
  expect(screen.getByText('还需自备：剪刀、清水')).toBeVisible()
})

it('groups eight general-materials specifications of one product without choosing an arbitrary SKU', () => {
  const general = Array.from({length:8}, (_, index) => ({ ...matches[0],
    kit:{ ...matches[0].kit,id:`k${index}`,kind:'general_materials' as const },
    linkedOffers:[{ ...matches[0].linkedOffers[0],id:`v${index}`,name:`通用包${index}`,productName:'通用科学实验材料包' }],
  }))
  render(<ProjectKitMatches matches={general} embedded />)
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByRole('link')).toHaveAttribute('href','/store/products/p1')
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  expect(screen.getByText('还没有材料？可以选购实验材料包。')).toBeVisible()
  expect(screen.queryByText(/器材可重复使用/)).not.toBeInTheDocument()
  expect(screen.queryByText('通用包0')).not.toBeInTheDocument()
})
it('keeps a unique general-materials variant precise and deduplicates confirmed extras', () => {
  const general = { ...matches[0],confirmed:true,preparationStatus:'extras' as const,extras:['清水'],
    kit:{ ...matches[0].kit,kind:'general_materials' as const },
  }
  render(<ProjectKitMatches matches={[general,{...general,kit:{...general.kit,id:'k2'}}]} embedded />)
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByRole('link')).toHaveAttribute('href','/store/products/p1?variant=v2')
  expect(screen.getByText('还需自备：清水')).toBeVisible()
})
