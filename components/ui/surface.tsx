import * as React from "react"

import { cn } from "@/lib/utils"

type SurfaceVariant = "panel" | "card" | "subtle"

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant
  interactive?: boolean
}

const surfaceVariantClass: Record<SurfaceVariant, string> = {
  panel: "surface-panel",
  card: "surface-card",
  subtle: "surface-subtle",
}

const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = "card", interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        surfaceVariantClass[variant],
        interactive && "surface-card-interactive",
        className
      )}
      {...props}
    />
  )
)
Surface.displayName = "Surface"

export { Surface }
