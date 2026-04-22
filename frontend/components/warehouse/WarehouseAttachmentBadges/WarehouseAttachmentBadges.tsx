import { OrderAttachmentBadges } from "@/components/orders/OrderAttachmentBadges/OrderAttachmentBadges"

type WarehouseAttachmentBadgesProps = {
  types: string[]
  reserveSpace?: boolean
}

export function WarehouseAttachmentBadges({
  types,
  reserveSpace = false,
}: WarehouseAttachmentBadgesProps) {
  return <OrderAttachmentBadges types={types} reserveSpace={reserveSpace} />
}
