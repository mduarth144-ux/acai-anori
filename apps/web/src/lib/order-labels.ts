/** Rótulos em português para enums persistidos em inglês no banco. */

const ORDER_STATUS: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

const ORDER_TYPE: Record<string, string> = {
  TABLE: 'Mesa',
  DELIVERY: 'Entrega',
  PICKUP: 'Retirada',
}

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS[status] ?? status
}

export function orderTypeLabel(type: string): string {
  return ORDER_TYPE[type] ?? type
}

/** Valores enviados à API (inglês) com rótulo para botões. */
export const ORDER_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'PREPARING', label: 'Em preparo' },
  { value: 'READY', label: 'Pronto' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
] as const
