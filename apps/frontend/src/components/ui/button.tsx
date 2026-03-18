import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] hover:shadow-sm",
  {
    variants: {
      variant: {
        default:
          "bg-skin-primary text-skin-text-inverse hover:bg-skin-primary-hover",
        destructive:
          "bg-skin-danger text-skin-text-inverse hover:bg-skin-danger/90",
        outline:
          "border border-skin-input-border bg-skin-surface text-skin-text hover:bg-skin-surface-hover",
        secondary:
          "bg-skin-secondary text-skin-text hover:bg-skin-surface-hover",
        ghost: "text-skin-text hover:bg-skin-menu-hover hover:text-skin-text hover:shadow-none",
        link: "text-skin-primary underline-offset-4 hover:underline hover:shadow-none",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
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
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
