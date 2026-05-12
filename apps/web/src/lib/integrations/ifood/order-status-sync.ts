import type { OrderStatus, OrderType } from '@prisma/client'
import {
  confirmIfoodOrder,
  dispatchIfoodOrder,
  getIfoodCancellationReasons,
  getIfoodOrderDetails,
  readyToPickupIfoodOrder,
  requestIfoodOrderCancellation,
  startPreparationIfoodOrder,
  updateIfoodOrderStatus,
} from './client'
import type { IfoodResponseJson } from './ifood-response'
import { getIfoodRefs } from './ifood-response'
import { isIfoodDedicatedOrderEndpointsEnabled } from './integration-flags'
import { logIntegration } from './logging'
import { mapLocalStatusToIfood } from './status-map'
import type { LocalOrderStatus } from './types'

/** Sincroniza transicoes de status do app com a Order API iFood (pedido ja existe no iFood). */

type OrderRow = {
  id: string
  type: OrderType
  status: OrderStatus
  ifoodResponse: unknown
}

export async function syncLocalStatusToIfoodApi(params: {
  order: OrderRow
  newStatus: LocalOrderStatus
  idempotencyKey: string
}): Promise<Partial<IfoodResponseJson>> {
  const refs = getIfoodRefs(params.order.ifoodResponse)
  const ifoodOrderId = refs.ifoodOrderId
  if (!ifoodOrderId || typeof ifoodOrderId !== 'string') {
    throw new Error('Pedido ainda sem ifoodOrderId (Order API iFood); aguarde a criacao na fila ou corrija a integracao.')
  }

  const dedicated = isIfoodDedicatedOrderEndpointsEnabled()
  const patch: Partial<IfoodResponseJson> = {}

  if (params.newStatus === 'CANCELLED') {
    const reasons = await getIfoodCancellationReasons(ifoodOrderId)
    const envDefault = process.env.IFOOD_DEFAULT_CANCEL_CODE?.trim()
    const cancellationCode =
      reasons[0]?.cancelCodeId ??
      envDefault ??
      ''
    if (!cancellationCode) {
      throw new Error(
        'Nenhum codigo de cancelamento disponivel no iFood (cancellationReasons vazio). Defina IFOOD_DEFAULT_CANCEL_CODE.'
      )
    }
    await requestIfoodOrderCancellation({
      ifoodOrderId,
      cancellationCode,
      reason: 'Cancelado pela loja (Cardapio Digital)',
      idempotencyKey: `${params.idempotencyKey}:cancel`,
    })
    return patch
  }

  if (dedicated) {
    if (params.newStatus === 'CONFIRMED') {
      await getIfoodOrderDetails(ifoodOrderId)
      await confirmIfoodOrder({
        ifoodOrderId,
        idempotencyKey: `${params.idempotencyKey}:confirm`,
      })
      return patch
    }
    if (params.newStatus === 'PREPARING') {
      await startPreparationIfoodOrder({
        ifoodOrderId,
        idempotencyKey: `${params.idempotencyKey}:prep`,
      })
      return patch
    }
    if (params.newStatus === 'READY') {
      await readyToPickupIfoodOrder({
        ifoodOrderId,
        idempotencyKey: `${params.idempotencyKey}:rtp`,
      })
      return patch
    }
    if (params.newStatus === 'DELIVERED') {
      if (params.order.type === 'DELIVERY' && !refs.ifoodDispatchNotifiedAt) {
        await dispatchIfoodOrder({
          ifoodOrderId,
          idempotencyKey: `${params.idempotencyKey}:dispatch`,
        })
        patch.ifoodDispatchNotifiedAt = new Date().toISOString()
      }
      await updateIfoodOrderStatus({
        ifoodOrderId,
        status: mapLocalStatusToIfood('DELIVERED'),
        idempotencyKey: `${params.idempotencyKey}:delivered`,
      })
      return patch
    }
  }

  await updateIfoodOrderStatus({
    ifoodOrderId,
    status: mapLocalStatusToIfood(params.newStatus),
    idempotencyKey: params.idempotencyKey,
  })
  logIntegration('info', 'Status iFood via endpoint generico', {
    orderId: params.order.id,
    localStatus: params.newStatus,
  })
  return patch
}
