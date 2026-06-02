import * as React from "react"

import { cn } from "@/lib/utils"

type FilterChipTone = "primary" | "green" | "amber" | "neutral"
type FilterChipSize = "sm" | "md"
type FilterChipShape = "soft" | "pill"

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  tone?: FilterChipTone
  size?: FilterChipSize
  shape?: FilterChipShape
  solid?: boolean
  tinted?: boolean
}

const toneClass: Record<FilterChipTone, string> = {
  primary: "filter-chip-active",
  green: "filter-chip-green",
  amber: "filter-chip-amber",
  neutral: "filter-chip-idle",
}

const sizeClass: Record<FilterChipSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "h-10 px-4 text-sm md:h-9 md:px-4",
}

const shapeClass: Record<FilterChipShape, string> = {
  soft: "rounded-sm",
  pill: "rounded-full",
}

const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  (
    {
      className,
      active = false,
      tone = "primary",
      size = "sm",
      shape = "soft",
      solid = false,
      tinted = false,
      type = "button",
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "filter-chip-base",
        sizeClass[size],
        shapeClass[shape],
        active ? (solid ? "filter-chip-active-solid" : toneClass[tone]) : tinted ? toneClass[tone] : "filter-chip-idle",
        className
      )}
      {...props}
    />
  )
)
FilterChip.displayName = "FilterChip"

export { FilterChip }
