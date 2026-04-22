import { type OrderExecutionMode } from "@/lib/orderModes"

export type SettingsPayload = {
  defaultVatRateId: number
  defaultOrderExecutionMode: OrderExecutionMode
  autoCalculateShipmentDeliveryCost: boolean
  useSupplierAssortment: boolean
  useSupplierLeadTime: boolean
}
