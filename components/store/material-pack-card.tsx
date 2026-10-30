import Link from 'next/link'
import { ArrowRight, Package } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/optimized-image'

export function MaterialPackCard({ name, variantName, imageUrl, href, description, materialAmount }: {
  name: string
  variantName?: string
  imageUrl?: string | null
  href: string
  description?: string
  materialAmount?: string
}) {
  const specification = variantName && variantName !== name ? variantName : undefined
  return (
    <Link href={href} aria-label={`查看材料包：${name}${specification ? ` · ${specification}` : ''}`}
      className="group flex min-w-0 items-start gap-4 rounded-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
      <span className="relative block h-[88px] w-[88px] shrink-0 overflow-hidden rounded-sm bg-muted/50 md:h-24 md:w-24">
        {imageUrl ? <OptimizedImage src={imageUrl} alt="" fill variant="thumbnail" sizes="96px" className="object-contain" /> : <span className="grid h-full place-items-center text-muted-foreground"><Package className="h-7 w-7" aria-hidden /></span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-base font-semibold leading-6 wrap-anywhere">{name}</span>
          {materialAmount ? <span className="shrink-0 text-sm leading-6 text-muted-foreground">{materialAmount}</span> : null}
        </span>
        {specification ? <span className="mt-1 block text-sm leading-6 text-muted-foreground wrap-anywhere">{specification}</span> : null}
        {description ? <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span> : null}
        <span className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary group-hover:underline group-hover:underline-offset-4">查看材料包<ArrowRight className="h-4 w-4" aria-hidden /></span>
      </span>
    </Link>
  )
}
