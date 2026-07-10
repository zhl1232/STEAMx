import * as React from "react"

import { cn } from "@/lib/utils"

export type CategoryTone = "science" | "tech" | "engineering" | "art" | "math" | "playground"

export const categoryToneClasses: Record<CategoryTone, { text: string; border: string; bg: string; badge: string }> = {
  science: {
    text: "text-[hsl(var(--tone-science))]",
    border: "border-[hsl(var(--tone-science-border))]",
    bg: "bg-[hsl(var(--tone-science-soft))]",
    badge: "bg-[hsl(var(--tone-science))] text-white in-[.black-gold]:text-black",
  },
  tech: {
    text: "text-[hsl(var(--tone-tech))]",
    border: "border-[hsl(var(--tone-tech-border))]",
    bg: "bg-[hsl(var(--tone-tech-soft))]",
    badge: "bg-[hsl(var(--tone-tech))] text-white in-[.black-gold]:text-black",
  },
  engineering: {
    text: "text-[hsl(var(--tone-engineering))]",
    border: "border-[hsl(var(--tone-engineering-border))]",
    bg: "bg-[hsl(var(--tone-engineering-soft))]",
    badge: "bg-[hsl(var(--tone-engineering))] text-white in-[.black-gold]:text-black",
  },
  art: {
    text: "text-[hsl(var(--tone-art))]",
    border: "border-[hsl(var(--tone-art-border))]",
    bg: "bg-[hsl(var(--tone-art-soft))]",
    badge: "bg-[hsl(var(--tone-art))] text-white in-[.black-gold]:text-black",
  },
  math: {
    text: "text-[hsl(var(--tone-math))]",
    border: "border-[hsl(var(--tone-math-border))]",
    bg: "bg-[hsl(var(--tone-math-soft))]",
    badge: "bg-[hsl(var(--tone-math))] text-white in-[.black-gold]:text-black",
  },
  playground: {
    text: "text-[hsl(var(--tone-playground))]",
    border: "border-[hsl(var(--tone-playground-border))]",
    bg: "bg-[hsl(var(--tone-playground-soft))]",
    badge: "bg-[hsl(var(--tone-playground))] text-white in-[.black-gold]:text-black",
  },
}

export interface ToneBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: CategoryTone
}

const ToneBadge = React.forwardRef<HTMLSpanElement, ToneBadgeProps>(
  ({ className, tone = "science", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-xs px-2.5 py-1 text-[11px] font-semibold",
        categoryToneClasses[tone].bg,
        categoryToneClasses[tone].text,
        className
      )}
      {...props}
    />
  )
)
ToneBadge.displayName = "ToneBadge"

export { ToneBadge }
