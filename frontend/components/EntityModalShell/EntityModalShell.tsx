import type { ReactNode } from "react"
import { FiX } from "react-icons/fi"

import { Button } from "@/components/ui/button"
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import styles from "./EntityModalShell.module.css"

type EntityModalShellProps = {
  children: ReactNode
  className?: string
  description?: ReactNode
  footer?: ReactNode
  footerClassName?: string
  onClose?: () => void
  title: ReactNode
}

export function EntityModalShell({
  children,
  className,
  description,
  footer,
  footerClassName,
  onClose,
  title,
}: EntityModalShellProps) {
  return (
    <DialogContent className={cn(styles.content, className)}>
      {onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Закрыть"
        >
          <FiX className="size-5" />
        </Button>
      ) : null}

      <DialogHeader className={styles.header}>
        <DialogTitle className={styles.title}>{title}</DialogTitle>
        {description ? (
          <DialogDescription className={styles.description}>
            {description}
          </DialogDescription>
        ) : null}
      </DialogHeader>

      <div className={styles.body}>{children}</div>

      {footer ? (
        <div className={cn(styles.footer, footerClassName)}>
          {footer}
        </div>
      ) : null}
    </DialogContent>
  )
}
