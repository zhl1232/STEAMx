'use client'

import { Sparkles } from 'lucide-react'
import Image from 'next/image'

import { CATEGORY_META } from '@/lib/config/categories'
import { categoryToneClasses } from '@/components/ui/tone-badge'
import { FilterChip } from '@/components/ui/filter-chip'
import { cn } from '@/lib/utils'

/** 手机分类条插画（Codex 生成，提示词见 ux-1027/refs/category-prompts.md） */
const CATEGORY_STRIP_IMAGES: Record<string, string> = {
  全部: 'all', 科学: 'science', 技术: 'tech', 工程: 'engineering', 艺术: 'art', 数学: 'math', 其他: 'other',
}
import { useCallback, useEffect, useRef, useState } from 'react'

interface ExploreCategoryStripProps {
  categories: string[]
  selectedCategory: string
  disabled?: boolean
  onSelect: (category: string) => void
}

/** Shared category navigation for both the browse and filtered explore states. */
export function ExploreCategoryStrip({
  categories,
  selectedCategory,
  disabled = false,
  onSelect,
}: ExploreCategoryStripProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const node = viewportRef.current
    if (!node) return
    const nextOverflow = node.scrollWidth > node.clientWidth + 1
    setOverflow(nextOverflow)
    setCanScrollLeft(node.scrollLeft > 1)
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    updateScrollState()
    node.addEventListener('scroll', updateScrollState, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollState)
    observer?.observe(node)
    return () => {
      node.removeEventListener('scroll', updateScrollState)
      observer?.disconnect()
    }
  }, [categories.length, updateScrollState])

  useEffect(() => {
    // 只滚动分类条自身；scrollIntoView 会连带滚动外层 overflow-hidden 容器，导致整页左移。
    const viewport = viewportRef.current
    const active = activeRef.current
    if (viewport && active) {
      const v = viewport.getBoundingClientRect()
      const a = active.getBoundingClientRect()
      const pad = 8
      if (a.left < v.left + pad) viewport.scrollLeft += a.left - v.left - pad
      else if (a.right > v.right - pad) viewport.scrollLeft += a.right - v.right + pad
    }
    updateScrollState()
  }, [selectedCategory, updateScrollState])

  return (
    <div className="relative md:static" data-testid="explore-category-strip">
      {overflow && canScrollRight ? <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-[hsl(var(--app-canvas))] to-transparent md:hidden" /> : null}
      <div ref={viewportRef} className="no-scrollbar @container -mx-2 -my-1 overflow-x-auto md:mx-0 md:my-0">
        {/* 手机：参考图 C 小照片+文字；电脑：原来的胶囊。同一按钮两套外观，避免测试/读屏重复。 */}
        <div className="flex min-w-max items-start gap-2 px-2 pb-2 pt-2 md:px-1 md:pb-1 md:pt-1 md:min-w-0 md:flex-wrap md:items-center md:gap-3">
          {categories.map((category) => {
            const meta = CATEGORY_META[category]
            const active = selectedCategory === category
            const tone = meta?.tone
            const Icon = meta?.icon ?? Sparkles
            const src = `/explore/categories/${CATEGORY_STRIP_IMAGES[category] ?? 'other'}.webp`
            return (
              <FilterChip
                ref={active ? activeRef : undefined}
                key={category}
                onClick={() => onSelect(category)}
                disabled={disabled}
                aria-pressed={active}
                active={active}
                solid={active && !tone}
                shape="pill"
                size="md"
                className={cn(
                  'max-md:h-auto max-md:min-w-0 max-md:border-transparent! max-md:bg-transparent! max-md:p-0! max-md:shadow-none! max-md:text-inherit!',
                  'h-11 min-w-[64px] px-3 text-[13px] font-semibold md:h-10 md:min-w-0 md:rounded-sm md:px-5 md:text-sm',
                  !active && 'border-transparent bg-[hsl(var(--surface-muted)/0.62)] text-foreground/76 shadow-none hover:bg-[hsl(var(--surface-muted)/0.9)] dark:bg-white/8 dark:text-foreground/84 dark:hover:bg-white/12',
                  active && tone && categoryToneClasses[tone].badge,
                )}
              >
                <span className="flex w-[clamp(52px,calc((100cqw-52px)/5.2),64px)] flex-col items-center gap-1.5 md:w-auto md:flex-row md:gap-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative mb-1 block aspect-square w-full overflow-hidden rounded-[16px] md:hidden dark:brightness-[0.92]',
                      !active && 'ring-1 ring-black/[0.06] dark:ring-white/[0.12]',
                    )}
                  >
                    <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                    {/* 选中框画在图片内侧（蓝 3px + 底色 2px 间隙），不会被任何外层 overflow 裁掉。 */}
                    {active ? (
                      <span className="pointer-events-none absolute inset-0 rounded-[16px] shadow-[inset_0_0_0_3px_hsl(var(--brand-blue)),inset_0_0_0_5px_hsl(var(--app-canvas))]" />
                    ) : null}
                  </span>
                  <Icon className="mr-0.5 hidden h-3.5 w-3.5 shrink-0 md:inline" strokeWidth={2.2} aria-hidden="true" />
                  <span className={cn('text-[13px] font-semibold leading-none max-md:text-[14px] md:text-inherit', active ? 'max-md:text-[hsl(var(--brand-blue))] max-md:font-bold' : 'max-md:text-foreground/80')}>
                    {category}
                  </span>
                </span>
              </FilterChip>
            )
          })}
        </div>
      </div>
    </div>
  )
}
