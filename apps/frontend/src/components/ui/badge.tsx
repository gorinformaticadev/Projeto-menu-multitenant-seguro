import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-skin-focus-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-skin-primary text-skin-text-inverse hover:bg-skin-primary-hover",
        secondary:
          "border-transparent bg-skin-secondary text-skin-text hover:bg-skin-surface-hover",
        destructive:
          "border-transparent bg-skin-danger text-skin-text-inverse hover:bg-skin-danger/90",
        outline: "border-skin-border bg-skin-surface text-skin-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
