type IntegrationSyncState = 'pending' | 'processing' | 'synced' | 'failed'

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
): Record<string, unknown> {
  const base =
    currentExternalRefs && typeof currentExternalRefs === 'object' && !Array.isArray(currentExternalRefs)
      ? ({ ...(currentExternalRefs as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const ifood = getIfoodRefs(currentExternalRefs)
  base.ifood = {
    ...ifood,
    ...patch,
  }
  return base
}
