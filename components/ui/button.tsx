import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                outline:
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            tone: {
                default: "",
                brand: "bg-[hsl(var(--brand-blue))] text-[hsl(var(--brand-blue-foreground))] hover:bg-[hsl(var(--brand-blue)/0.92)]",
                success: "bg-[hsl(var(--status-success))] text-[hsl(var(--status-success-foreground))] hover:bg-[hsl(var(--status-success)/0.92)] shadow-[0_18px_34px_-22px_hsl(var(--status-success)/0.9)]",
                warning: "bg-[hsl(var(--status-warning))] text-[hsl(var(--status-warning-foreground))] hover:bg-[hsl(var(--status-warning)/0.92)]",
                danger: "bg-[hsl(var(--status-danger))] text-[hsl(var(--status-danger-foreground))] hover:bg-[hsl(var(--status-danger)/0.92)]",
            },
            shape: {
                default: "rounded-sm",
                soft: "rounded-sm",
                pill: "rounded-full",
                square: "rounded-xs",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 px-3",
                lg: "h-11 px-8",
                icon: "h-10 w-10",
            },
        },
        compoundVariants: [
            { size: "sm", shape: "default", class: "rounded-sm" },
            { size: "sm", shape: "soft", class: "rounded-sm" },
            { size: "lg", shape: "default", class: "rounded-sm" },
        ],
        defaultVariants: {
            variant: "default",
            tone: "default",
            shape: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, tone, shape, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        const useTone = tone && tone !== "default"
        return (
            <Comp
                className={cn(
                    buttonVariants({
                        variant: useTone ? "default" : variant,
                        tone: useTone ? tone : "default",
                        shape,
                        size,
                    }),
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
