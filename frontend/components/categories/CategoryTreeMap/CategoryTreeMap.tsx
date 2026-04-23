import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { FiMove } from "react-icons/fi"

import type { Category, CategoryTreeNode, TreeColumn } from "@/types/pages/categories"
import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import styles from "./CategoryTreeMap.module.css"

type CategoryTreeMapProps = {
  treeColumns: TreeColumn[]
  nodeMap: Map<number, CategoryTreeNode>
  selectedCategoryId: number | null
  activePathIds: number[]
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onSelectCategory: (category: Category) => void
  onOpenCategory?: (category: Category) => void
}

type Point = {
  x: number
  y: number
}

const INITIAL_OFFSET: Point = { x: 24, y: 24 }
const CANVAS_PADDING_X = 24
const CANVAS_PADDING_Y = 24

export function CategoryTreeMap({
  treeColumns,
  nodeMap,
  selectedCategoryId,
  activePathIds,
  searchTerm,
  onSearchTermChange,
  onSelectCategory,
  onOpenCategory,
}: CategoryTreeMapProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const [isPanning, setIsPanning] = useState(false)
  const [panOffset, setPanOffset] = useState<Point>(INITIAL_OFFSET)

  const clampOffset = useCallback((next: Point): Point => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current

    if (!viewport || !canvas) {
      return next
    }

    const viewportWidth = viewport.clientWidth
    const viewportHeight = viewport.clientHeight
    const canvasWidth = canvas.offsetWidth
    const canvasHeight = canvas.offsetHeight

    const minX = canvasWidth + CANVAS_PADDING_X > viewportWidth
      ? viewportWidth - canvasWidth - CANVAS_PADDING_X
      : CANVAS_PADDING_X
    const maxX = CANVAS_PADDING_X
    const minY = canvasHeight + CANVAS_PADDING_Y > viewportHeight
      ? viewportHeight - canvasHeight - CANVAS_PADDING_Y
      : CANVAS_PADDING_Y
    const maxY = CANVAS_PADDING_Y

    return {
      x: Math.min(Math.max(next.x, Math.min(minX, maxX)), Math.max(minX, maxX)),
      y: Math.min(Math.max(next.y, Math.min(minY, maxY)), Math.max(minY, maxY)),
    }
  }, [])

  const resetView = useCallback(() => {
    setPanOffset(clampOffset(INITIAL_OFFSET))
  }, [clampOffset])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setPanOffset((current) => clampOffset(current))
    })

    const handleResize = () => {
      setPanOffset((current) => clampOffset(current))
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", handleResize)
    }
  }, [clampOffset, treeColumns.length, searchTerm, selectedCategoryId])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-category-node='true']")) {
      return
    }

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    }

    setIsPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) {
      return
    }

    const deltaX = event.clientX - dragStateRef.current.startX
    const deltaY = event.clientY - dragStateRef.current.startY

    setPanOffset(
      clampOffset({
        x: dragStateRef.current.originX + deltaX,
        y: dragStateRef.current.originY + deltaY,
      })
    )
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null
    setIsPanning(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const hasColumns = treeColumns.length > 0

  const hintLabel = useMemo(() => {
    if (!hasColumns) {
      return "Категории не найдены"
    }

    return isPanning ? "Перемещение..." : "Перетащите фон, чтобы двигать карту"
  }, [hasColumns, isPanning])

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h2 className={styles.title}>Карта категорий</h2>
          <p className={styles.description}>
            Выбирайте узел слева направо: следующая колонка показывает его подкатегории.
          </p>
        </div>

        <div className={styles.toolbar}>
          <DataSearchField
            value={searchTerm}
            onValueChange={onSearchTermChange}
            placeholder="Поиск по названию или описанию"
            wrapperClassName={styles.search}
          />
          <Button type="button" variant="outline" className={styles.resetButton} onClick={resetView}>
            <FiMove />
            Сбросить вид
          </Button>
        </div>
      </div>

      {!hasColumns ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Ничего не найдено</div>
          <div className={styles.emptyText}>Измените поисковый запрос или добавьте новую категорию.</div>
        </div>
      ) : (
        <div
          ref={viewportRef}
          className={styles.viewport}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className={styles.viewportHint}>{hintLabel}</div>

          <div
            ref={canvasRef}
            className={cn(styles.canvas, isPanning && styles.canvasPanning)}
            style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
          >
            {treeColumns.map((column, columnIndex) => {
              const columnParent = column.parentId ? nodeMap.get(column.parentId) || null : null

              return (
                <div key={`tree-column-${columnIndex}`} className={styles.column}>
                  <div className={styles.columnHeader}>
                    {columnIndex === 0 ? "Корневые категории" : `Подкатегории: ${columnParent?.название || ""}`}
                  </div>

                  <div className={styles.nodes}>
                    {column.nodes.map((category) => {
                      const isSelected = selectedCategoryId === category.id
                      const isInActivePath = activePathIds.includes(category.id)

                      return (
                        <article
                          key={category.id}
                          className={cn(
                            styles.node,
                            isSelected && styles.nodeSelected,
                            !isSelected && isInActivePath && styles.nodeInPath,
                            !category.активна && styles.nodeInactive
                          )}
                        >
                          <button
                            type="button"
                            data-category-node="true"
                            className={styles.nodeButton}
                            onClick={() => onSelectCategory(category)}
                            onDoubleClick={() => onOpenCategory?.(category)}
                          >
                            <div className={styles.nodeHeader}>
                              <div className={styles.nodeTitle}>{category.название}</div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  styles.statusBadge,
                                  category.активна ? styles.activeBadge : styles.inactiveBadge
                                )}
                              >
                                {category.активна ? "Активна" : "Неактивна"}
                              </Badge>
                            </div>

                            <div className={styles.nodeDescription}>
                              {category.описание || "Описание не указано"}
                            </div>

                            <div className={styles.nodeFooter}>
                              <span>#{category.id}</span>
                              <span>{category.children.length} доч.</span>
                            </div>
                          </button>
                        </article>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
