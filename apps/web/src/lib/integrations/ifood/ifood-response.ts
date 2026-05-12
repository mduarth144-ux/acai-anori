import { Prisma } from '@prisma/client'

/**
 * JSON gravado em `Order.ifoodResponse`: ids, respostas das APIs iFood e estado de sincronização.
 */
export type IfoodResponseJson = {
  ifoodOrderId?: string
  /** Corpo JSON da criação: Order API iFood ou, em fluxo shipping-first, resposta do POST na Shipping API. */
  orderCreateApiResponse?: Record<string, unknown>
  /** Corpo JSON devolvido pelo POST de pedido na Shipping API (entrega). */
  shippingOrderApiResponse?: Record<string, unknown>
  shippingOrderId?: string
  deliveryQuoteId?: string
  deliveryId?: string
  deliveryStatus?: string
  /** ISO timestamp — despacho (saida para entrega) ja enviado ao iFood */
  ifoodDispatchNotifiedAt?: string
  syncState?: 'pending' | 'processing' | 'synced' | 'failed'
  syncError?: string | null
  /** Quem atualizou: app/outbox (`internal`) vs webhook (`ifood-webhook`). */
  source?: 'internal' | 'ifood-webhook'
  lastSyncAt?: string
  lastWebhookEventId?: string
  lastStatusSyncedAt?: string
  /** Último `status` bruto devolvido por GET Order Details (sync admin). */
  lastIfoodOrderStatus?: string
  lastOrderDetailsSyncAt?: string
}

/** @deprecated use `IfoodResponseJson` */
export type IfoodExternalRefs = IfoodResponseJson

/**
 * Lê o blob iFood a partir de `Order.ifoodResponse` ou, em legado, de um objeto com chave `ifood`.
 */
export function getIfoodResponse(raw: unknown): IfoodResponseJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const o = raw as Record<string, unknown>
  if ('ifood' in o && typeof o.ifood === 'object' && o.ifood !== null && !Array.isArray(o.ifood)) {
    return o.ifood as IfoodResponseJson
  }
  return o as IfoodResponseJson
}

/** Alias legível em chamadas que ainda dizem “refs”. */
export const getIfoodRefs = getIfoodResponse

/**
 * Id do pedido na Order API iFood: campo dedicado ou fallback no JSON de criação.
 */
export function resolveIfoodOrderIdForApis(refs: IfoodResponseJson): string | undefined {
  const direct = typeof refs.ifoodOrderId === 'string' ? refs.ifoodOrderId.trim() : ''
  if (direct.length > 0) return direct
  const resp = refs.orderCreateApiResponse
  if (resp && typeof resp === 'object' && !Array.isArray(resp)) {
    const oid = typeof resp.orderId === 'string' ? resp.orderId.trim() : ''
    if (oid.length > 0) return oid
    const iid = typeof resp.id === 'string' ? resp.id.trim() : ''
    if (iid.length > 0) return iid
  }
  return undefined
}

export function mergeIfoodResponse(
  currentIfoodResponse: unknown,
  patch: Partial<IfoodResponseJson>
): Prisma.InputJsonObject {
  const prev = getIfoodResponse(currentIfoodResponse)
  return {
    ...prev,
    ...patch,
  } as Prisma.InputJsonObject
}

/** @deprecated use `mergeIfoodResponse` */
export const mergeIfoodRefs = mergeIfoodResponse
