'use client'

import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
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
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    updateScrollState()
  }, [selectedCategory, updateScrollState])

  const scrollBy = (direction: number) => {
    viewportRef.current?.scrollBy({ left: direction * Math.max(160, viewportRef.current.clientWidth * 0.7), behavior: 'smooth' })
  }

  return (
    <div className="relative md:static" data-testid="explore-category-strip">
      {overflow && canScrollLeft ? <button type="button" aria-label="向左滚动分类" onClick={() => scrollBy(-1)} className="absolute left-0 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border bg-background/90 shadow-sm md:hidden"><ChevronLeft className="h-4 w-4" /></button> : null}
      {overflow && canScrollRight ? <button type="button" aria-label="向右滚动分类" onClick={() => scrollBy(1)} className="absolute right-0 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border bg-background/90 shadow-sm md:hidden"><ChevronRight className="h-4 w-4" /></button> : null}
      <div ref={viewportRef} className="no-scrollbar overflow-x-auto">
        {/* 手机：参考图 C 小照片+文字；电脑：原来的胶囊。同一按钮两套外观，避免测试/读屏重复。 */}
        <div className="flex min-w-max items-start gap-3 px-1 pb-1 pt-1 md:min-w-0 md:flex-wrap md:items-center md:gap-3">
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
                <span className="flex w-[96px] flex-col items-center gap-1.5 md:w-auto md:flex-row md:gap-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative mb-1 block h-[96px] w-[96px] overflow-hidden rounded-[20px] md:hidden dark:brightness-[0.92]',
                      active ? 'ring-[3px] ring-[hsl(var(--brand-blue))] ring-offset-2 ring-offset-background' : 'ring-1 ring-black/[0.06] dark:ring-white/[0.12]',
                    )}
                  >
                    <Image src={src} alt="" fill sizes="96px" className="object-cover" />
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
