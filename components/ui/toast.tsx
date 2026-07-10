"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-100 flex max-h-[calc(100dvh-7rem)] flex-col-reverse gap-2 p-0 sm:inset-x-4 md:bottom-0 md:left-auto md:right-0 md:top-auto md:max-h-screen md:w-full md:max-w-[420px] md:flex-col md:p-4",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex min-h-13 w-full items-center justify-between gap-3 overflow-hidden rounded-md border px-4 py-3 pr-12 shadow-[0_18px_42px_-28px_hsl(var(--surface-shadow)/0.55)] backdrop-blur-xl transition-all md:min-h-0 md:rounded-xs md:p-6 md:pr-8 md:shadow-lg md:backdrop-blur-none data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full max-md:data-[state=closed]:slide-out-to-bottom-full md:data-[state=closed]:slide-out-to-right-full",
  {
    variants: {
      variant: {
        default:
          "border-[hsl(var(--surface-border)/0.9)] bg-[hsl(var(--surface-raised)/0.96)] text-foreground supports-backdrop-filter:bg-[hsl(var(--surface-raised)/0.88)] dark:border-[hsl(var(--surface-border)/0.82)]",
        destructive:
          "destructive border-[hsl(var(--status-danger-border))] bg-[hsl(var(--status-danger-surface)/0.98)] text-foreground supports-backdrop-filter:bg-[hsl(var(--status-danger-surface)/0.92)] dark:border-[hsl(var(--status-danger)/0.45)] dark:bg-[hsl(var(--status-danger)/0.16)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex min-h-10 shrink-0 items-center justify-center rounded-sm border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 md:h-8 md:min-h-0 md:rounded-xs group-[.destructive]:border-[hsl(var(--status-danger-border))] group-[.destructive]:text-[hsl(var(--status-danger))] hover:group-[.destructive]:border-[hsl(var(--status-danger)/0.45)] hover:group-[.destructive]:bg-[hsl(var(--status-danger)/0.12)] focus:group-[.destructive]:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm text-foreground/55 opacity-80 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring md:right-2 md:top-2 md:h-auto md:w-auto md:translate-y-0 md:p-1 md:opacity-0 md:group-hover:opacity-100 group-[.destructive]:text-[hsl(var(--status-danger))] hover:group-[.destructive]:text-[hsl(var(--status-danger))] focus:group-[.destructive]:ring-[hsl(var(--status-danger))]",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-medium leading-5 md:font-semibold group-[.destructive]:text-[hsl(var(--status-danger))]", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs leading-4 text-muted-foreground md:text-sm md:opacity-90 group-[.destructive]:text-foreground/75", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
