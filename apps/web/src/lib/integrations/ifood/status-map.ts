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
