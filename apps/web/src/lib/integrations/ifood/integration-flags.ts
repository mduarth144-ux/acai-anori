/**
 * Flags opcionais. Documentar em `.env.local.example`.
 */

export function isIfoodDedicatedOrderEndpointsEnabled(): boolean {
  return (process.env.IFOOD_ORDER_USE_DEDICATED_ENDPOINTS?.trim() || 'true').toLowerCase() !== 'false'
}

export function isIfoodEventsPollingEnabled(): boolean {
  return (process.env.IFOOD_EVENTS_POLLING_ENABLED?.trim() || 'false').toLowerCase() === 'true'
}

/**
 * Onde criar o pedido no iFood primeiro.
 * - `shipping`: `POST /shipping/v1.0/merchants/{merchantId}/orders` (entrega com endereço; evita Order API 404 quando o OAuth não tem rota `/order/...`).
 * - `order_api`: `POST` em `IFOOD_ORDER_CREATE_PATH` (Order API).
 */
export function getIfoodPrimaryOrderCreateStrategy(
  orderType: string,
  hasDeliveryAddress: boolean
): 'shipping' | 'order_api' {
  const raw = process.env.IFOOD_PRIMARY_ORDER_CREATE?.trim().toLowerCase()
  if (raw === 'order_api') return 'order_api'
  if (raw === 'shipping') return 'shipping'
  if (orderType === 'DELIVERY' && hasDeliveryAddress) return 'shipping'
  return 'order_api'
}
