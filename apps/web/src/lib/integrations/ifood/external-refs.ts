import { Prisma } from '@prisma/client'

type IntegrationSyncState = 'pending' | 'processing' | 'synced' | 'failed'

export type IfoodExternalRefs = {
  ifoodOrderId?: string
  shippingOrderId?: string
  deliveryQuoteId?: string
  deliveryId?: string
  deliveryStatus?: string
  /** ISO timestamp — despacho (saida para entrega) ja enviado ao iFood */
  ifoodDispatchNotifiedAt?: string
  syncState?: IntegrationSyncState
  syncError?: string | null
  source?: 'internal' | 'ifood-webhook'
  lastSyncAt?: string
  lastWebhookEventId?: string
  lastStatusSyncedAt?: string
}

export function getIfoodRefs(externalRefs: unknown): IfoodExternalRefs {
  if (!externalRefs || typeof externalRefs !== 'object' || Array.isArray(externalRefs)) {
    return {}
  }
  const refs = externalRefs as Record<string, unknown>
  const ifood = refs.ifood
  if (!ifood || typeof ifood !== 'object' || Array.isArray(ifood)) {
    return {}
  }
  return ifood as IfoodExternalRefs
}

export function mergeIfoodRefs(
  currentExternalRefs: unknown,
  patch: Partial<IfoodExternalRefs>
): Prisma.InputJsonObject {
  const base =
    currentExternalRefs && typeof currentExternalRefs === 'object' && !Array.isArray(currentExternalRefs)
      ? ({ ...(currentExternalRefs as Record<string, Prisma.InputJsonValue>) } as Record<
          string,
          Prisma.InputJsonValue
        >)
      : {}

  const ifood = getIfoodRefs(currentExternalRefs)
  return {
    ...base,
    ifood: {
      ...ifood,
      ...patch,
    } as Prisma.InputJsonObject,
  } as Prisma.InputJsonObject
}
