import { OrderAttachmentBadges } from "@/components/orders/OrderAttachmentBadges/OrderAttachmentBadges"

type ClientAttachmentBadgesProps = {
  types: string[]
  reserveSpace?: boolean
}

export function ClientAttachmentBadges({ types, reserveSpace = false }: ClientAttachmentBadgesProps) {
  return <OrderAttachmentBadges types={types} reserveSpace={reserveSpace} />
}
