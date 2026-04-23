export type AttachmentRegistryLink = {
  entity_type: string
  entity_id: number
  entity_label: string
  title: string
  subtitle: string | null
  href: string | null
}

export type AttachmentRegistryItem = {
  id: string
  filename: string
  mime_type: string
  size_bytes: number | string | null
  created_at: string
  links: AttachmentRegistryLink[]
  is_unattached: boolean
}

export type TargetOption = {
  id: number
  title: string
  subtitle: string | null
}

export type EntityTypeValue =
  | "order"
  | "client"
  | "purchase"
  | "shipment"
  | "supplier"
  | "transport"
  | "manager"
  | "product"

export type RelationFilterValue = "all" | "unattached" | EntityTypeValue
export type FileTypeFilterValue = "all" | "pdf" | "word" | "excel" | "image" | "file"
export type SortValue =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc"

export type FilterTab = "relation" | "type"
