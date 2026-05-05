import { Prisma } from '@prisma/client'

type IntegrationSyncState = 'pending' | 'processing' | 'synced' | 'failed'
type CancellationState =
  | 'NONE'
  | 'REQUESTED'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_REJECTED'
  | 'AGREEMENT_PROPOSED'
  | 'AGREEMENT_ACCEPTED'
  | 'AGREEMENT_REJECTED'
  | 'CANCELLED'

export type IfoodExternalRefs = {
  ifoodOrderId?: string
  deliveryQuoteId?: string
  deliveryId?: string
  deliveryStatus?: string
  syncState?: IntegrationSyncState
  syncError?: string | null
  source?: 'internal' | 'ifood-webhook'
  lastSyncAt?: string
  lastWebhookEventId?: string
  lastStatusSyncedAt?: string
  cancellationState?: CancellationState
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
