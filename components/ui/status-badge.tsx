import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      status: {
        success: "status-success-surface border",
        warning: "status-warning-surface border",
        danger: "status-danger-surface border",
        info: "status-info-surface border",
        neutral: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "neutral",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

export function StatusBadge({ className, status, ...props }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ status }), className)} {...props} />
}

export function StatusAlert({
  className,
  status = "info",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof statusBadgeVariants>) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        status === "success" && "status-success-surface",
        status === "warning" && "status-warning-surface",
        status === "danger" && "status-danger-surface",
        status === "info" && "status-info-surface",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
