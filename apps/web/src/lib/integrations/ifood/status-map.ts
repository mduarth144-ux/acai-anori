import type { IfoodOrderStatus, LocalOrderStatus } from './types'

const LOCAL_TO_IFOOD: Record<LocalOrderStatus, IfoodOrderStatus> = {
  PENDING: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY: 'READY_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

const IFOOD_TO_LOCAL: Record<IfoodOrderStatus, LocalOrderStatus> = {
  PLACED: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY_FOR_DELIVERY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

export function mapLocalStatusToIfood(status: LocalOrderStatus): IfoodOrderStatus {
  return LOCAL_TO_IFOOD[status]
}

export function mapIfoodStatusToLocal(status: IfoodOrderStatus): LocalOrderStatus {
  return IFOOD_TO_LOCAL[status]
}

/** Quando o webhook envia `code` que nao existe no mapa (ex.: eventos so de logistica). */
export function mapIfoodStatusToLocalOptional(status: string): LocalOrderStatus | undefined {
  const normalized = status.trim()
  if (Object.prototype.hasOwnProperty.call(IFOOD_TO_LOCAL, normalized)) {
    return IFOOD_TO_LOCAL[normalized as IfoodOrderStatus]
  }
  /** Evento de fim de ciclo na API de eventos iFood (ex.: fullCode ORDER_CONCLUDED, code CONCLUDED). */
  if (
    normalized === 'CONCLUDED' ||
    normalized === 'ORDER_CONCLUDED' ||
    (normalized.endsWith('_CONCLUDED') && !normalized.includes('CANCEL'))
  ) {
    return 'DELIVERED'
  }
  return undefined
}

export function isValidLocalTransition(
  currentStatus: LocalOrderStatus,
  nextStatus: LocalOrderStatus
): boolean {
  if (currentStatus === nextStatus) return true

  const flow: Record<LocalOrderStatus, LocalOrderStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
  }

  return flow[currentStatus].includes(nextStatus)
}
