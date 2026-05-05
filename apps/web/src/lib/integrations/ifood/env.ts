type IfoodEnv = {
  clientId: string
  clientSecret: string
  merchantId: string
  webhookSecret: string
  apiBaseUrl: string
  authUrl: string
  shippingEnabled: boolean
  shippingQuotePath: string
  shippingOrderPath: string
  orderDetailsPath: string
  eventsAckPath: string
  orderReadyPath: string
  orderDispatchPath: string
  cancelBasePath: string
  catalogBasePath: string
  merchantBasePath: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Variavel obrigatoria nao definida: ${name}`)
  }
  return value
}

export function getIfoodEnv(): IfoodEnv {
  return {
    clientId: requiredEnv('IFOOD_CLIENT_ID'),
    clientSecret: requiredEnv('IFOOD_CLIENT_SECRET'),
    merchantId: requiredEnv('IFOOD_MERCHANT_ID'),
    webhookSecret: requiredEnv('IFOOD_WEBHOOK_SECRET'),
    apiBaseUrl: process.env.IFOOD_API_BASE_URL?.trim() || 'https://merchant-api.ifood.com.br',
    authUrl: process.env.IFOOD_AUTH_URL?.trim() || 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token',
    shippingEnabled: (process.env.IFOOD_SHIPPING_ENABLED?.trim() || 'true').toLowerCase() !== 'false',
    shippingQuotePath: process.env.IFOOD_SHIPPING_QUOTE_PATH?.trim() || '/shipping/v1.0/quotes',
    shippingOrderPath:
      process.env.IFOOD_SHIPPING_ORDER_PATH?.trim() || '/shipping/v1.0/merchants/{merchantId}/orders',
    orderDetailsPath: process.env.IFOOD_ORDER_DETAILS_PATH?.trim() || '/order/v1.0/orders/{orderId}',
    eventsAckPath: process.env.IFOOD_EVENTS_ACK_PATH?.trim() || '/order/v1.0/events/{eventId}/acknowledgment',
    orderReadyPath:
      process.env.IFOOD_ORDER_READY_PATH?.trim() || '/order/v1.0/orders/{orderId}/ready-for-pickup',
    orderDispatchPath:
      process.env.IFOOD_ORDER_DISPATCH_PATH?.trim() || '/order/v1.0/orders/{orderId}/dispatch',
    cancelBasePath: process.env.IFOOD_CANCEL_BASE_PATH?.trim() || '/order/v1.0/orders/{orderId}/cancellation',
    catalogBasePath: process.env.IFOOD_CATALOG_BASE_PATH?.trim() || '/catalog/v2.0',
    merchantBasePath: process.env.IFOOD_MERCHANT_BASE_PATH?.trim() || '/merchant/v1.0',
  }
}
