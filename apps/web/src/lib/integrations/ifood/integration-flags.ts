/**
 * Flags opcionais para não alterar comportamento em deploys existentes.
 * Documentar em `.env.local.example`.
 */

export function isIfoodOrderApiOnCreateEnabled(): boolean {
  return (process.env.IFOOD_ORDER_API_ON_CREATE?.trim() || 'false').toLowerCase() === 'true'
}

export function isIfoodDedicatedOrderEndpointsEnabled(): boolean {
  return (process.env.IFOOD_ORDER_USE_DEDICATED_ENDPOINTS?.trim() || 'true').toLowerCase() !== 'false'
}

export function isIfoodEventsPollingEnabled(): boolean {
  return (process.env.IFOOD_EVENTS_POLLING_ENABLED?.trim() || 'false').toLowerCase() === 'true'
}
