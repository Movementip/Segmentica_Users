import * as React from "react"
import { FiPlus } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import styles from "./CreateEntityButton.module.css"

type CreateEntityButtonProps = React.ComponentProps<typeof Button> & {
  icon?: React.ReactNode
}

export function CreateEntityButton({
  className,
  children,
  icon = <FiPlus data-icon="inline-start" className="size-4" />,
  ...props
}: CreateEntityButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(styles.root, className)}
      {...props}
    >
      {icon}
      {children}
    </Button>
  )
}
