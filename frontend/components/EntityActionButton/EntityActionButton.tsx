import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import styles from "./EntityActionButton.module.css"

type EntityActionButtonVariant = "neutral" | "danger"

type EntityActionButtonProps = React.ComponentProps<typeof Button> & {
  tone?: EntityActionButtonVariant
}

export const EntityActionButton = React.forwardRef<
  HTMLButtonElement,
  EntityActionButtonProps
>(({ className, tone = "neutral", variant = "outline", size = "default", ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(styles.root, styles[tone], className)}
      {...props}
    />
  )
})

EntityActionButton.displayName = "EntityActionButton"
