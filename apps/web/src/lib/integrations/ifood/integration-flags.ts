/**
 * Flags opcionais. Documentar em `.env.local.example`.
 */

export function isIfoodDedicatedOrderEndpointsEnabled(): boolean {
  return (process.env.IFOOD_ORDER_USE_DEDICATED_ENDPOINTS?.trim() || 'true').toLowerCase() !== 'false'
}

export function isIfoodEventsPollingEnabled(): boolean {
  return (process.env.IFOOD_EVENTS_POLLING_ENABLED?.trim() || 'false').toLowerCase() === 'true'
}
