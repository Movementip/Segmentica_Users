import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PaginationItem = number | "ellipsis"

export function buildPagination(
  currentPage: number,
  totalPages: number
): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ])

  const normalized = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  const result: PaginationItem[] = []

  for (let index = 0; index < normalized.length; index += 1) {
    const page = normalized[index]
    const previous = normalized[index - 1]

    if (index > 0 && previous != null && page - previous > 1) {
      result.push("ellipsis")
    }

    result.push(page)
  }

  return result
}

type PaginationProps = {
  currentPage: number
  totalPages: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  summary?: React.ReactNode
  className?: string
  summaryClassName?: string
  controlsClassName?: string
  buttonClassName?: string
  activeButtonClassName?: string
  ellipsisClassName?: string
  previousLabel?: React.ReactNode
  nextLabel?: React.ReactNode
}

export function Pagination({
  currentPage,
  totalPages,
  isLoading = false,
  onPageChange,
  summary,
  className,
  summaryClassName,
  controlsClassName,
  buttonClassName,
  activeButtonClassName,
  ellipsisClassName,
  previousLabel = "Назад",
  nextLabel = "Вперёд",
}: PaginationProps) {
  const items = React.useMemo(
    () => buildPagination(currentPage, totalPages),
    [currentPage, totalPages]
  )

  if (totalPages <= 1) return null

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || isLoading) return
    onPageChange(page)
  }

  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)}>
      {summary ? (
        <div
          className={cn(
            "text-center text-sm text-muted-foreground",
            summaryClassName
          )}
        >
          {summary}
        </div>
      ) : null}

      <div
        className={cn(
          "flex w-full flex-wrap items-center justify-center gap-2",
          controlsClassName
        )}
      >
        <Button
          type="button"
          variant="outline"
          className={cn(
            "min-w-10 rounded-xl px-3 text-sm font-semibold",
            buttonClassName
          )}
          disabled={currentPage <= 1 || isLoading}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          {previousLabel}
        </Button>

        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className={cn(
                "inline-flex h-10 min-w-6 items-center justify-center px-1 text-sm text-muted-foreground",
                ellipsisClassName
              )}
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={item === currentPage ? "secondary" : "outline"}
              aria-current={item === currentPage ? "page" : undefined}
              data-active={item === currentPage ? "true" : "false"}
              className={cn(
                "min-w-10 rounded-xl px-3 text-sm font-semibold",
                buttonClassName,
                item === currentPage && activeButtonClassName
              )}
              disabled={isLoading}
              onClick={() => handlePageChange(item)}
            >
              {item}
            </Button>
          )
        )}

        <Button
          type="button"
          variant="outline"
          className={cn(
            "min-w-10 rounded-xl px-3 text-sm font-semibold",
            buttonClassName
          )}
          disabled={currentPage >= totalPages || isLoading}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  )
}
