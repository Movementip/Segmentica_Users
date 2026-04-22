import { Badge } from "@/components/ui/badge"

import styles from "./OrderAttachmentBadges.module.css"

type OrderAttachmentBadgesProps = {
  types: string[]
  reserveSpace?: boolean
}

const visibleAttachmentTypes = ["pdf", "word", "excel", "image", "file"]

function getAttachmentBadge(type: string) {
  switch (type) {
    case "pdf":
      return { label: "PDF", color: "red" }
    case "word":
      return { label: "WORD", color: "blue" }
    case "excel":
      return { label: "EXCEL", color: "green" }
    case "image":
      return { label: "IMG", color: "amber" }
    default:
      return { label: "FILE", color: "amber" }
  }
}

export function OrderAttachmentBadges({
  types,
  reserveSpace = false,
}: OrderAttachmentBadgesProps) {
  const normalized = Array.from(new Set(types))
  const visibleTypes = normalized.filter((type) => visibleAttachmentTypes.includes(type))

  if (visibleTypes.length === 0 && !reserveSpace) return null

  return (
    <div
      className={styles.attachmentBadges}
      data-empty={visibleTypes.length === 0 ? "true" : "false"}
      data-reserve-space={reserveSpace ? "true" : "false"}
    >
      {visibleTypes.length > 0 ? (
        visibleTypes.map((type) => {
          const badge = getAttachmentBadge(type)

          return (
            <Badge
              key={type}
              variant="secondary"
              className={styles.attachmentBadge}
              data-file-type={badge.color}
            >
              {badge.label}
            </Badge>
          )
        })
      ) : reserveSpace ? (
        <span className={styles.attachmentPlaceholder} aria-hidden="true" />
      ) : null}
    </div>
  )
}
