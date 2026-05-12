type IfoodEnv = {
  clientId: string
  clientSecret: string
  merchantId: string
  webhookSecret: string
  apiBaseUrl: string
  authUrl: string
  /** Path absoluto (começa com `/`) para POST de criação de pedido na Order API. */
  orderCreatePath: string
  shippingEnabled: boolean
  shippingQuotePath: string
  shippingOrderPath: string
  shippingAvailabilityPath: string
  shippingDeliveryAreaPath: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Variavel obrigatoria nao definida: ${name}`)
  }
  return value
}

export function getIfoodEnv(): IfoodEnv {
  const rawBase =
    process.env.IFOOD_API_BASE_URL?.trim() || 'https://merchant-api.ifood.com.br'
  const apiBaseUrl = rawBase.replace(/\/+$/, '')
  const rawCreate =
    process.env.IFOOD_ORDER_CREATE_PATH?.trim() || '/order/v1.0/orders'
  const orderCreatePath = rawCreate.startsWith('/') ? rawCreate : `/${rawCreate}`

  return {
    clientId: requiredEnv('IFOOD_CLIENT_ID'),
    clientSecret: requiredEnv('IFOOD_CLIENT_SECRET'),
    merchantId: requiredEnv('IFOOD_MERCHANT_ID'),
    webhookSecret: requiredEnv('IFOOD_WEBHOOK_SECRET'),
    apiBaseUrl,
    authUrl: process.env.IFOOD_AUTH_URL?.trim() || 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token',
    orderCreatePath,
    shippingEnabled: (process.env.IFOOD_SHIPPING_ENABLED?.trim() || 'true').toLowerCase() !== 'false',
    shippingQuotePath: process.env.IFOOD_SHIPPING_QUOTE_PATH?.trim() || '/shipping/v1.0/quotes',
    shippingOrderPath:
      process.env.IFOOD_SHIPPING_ORDER_PATH?.trim() || '/shipping/v1.0/merchants/{merchantId}/orders',
    shippingAvailabilityPath:
      process.env.IFOOD_SHIPPING_AVAILABILITY_PATH?.trim() ||
      '/shipping/v1.0/merchants/{merchantId}/deliveryAvailabilities',
    shippingDeliveryAreaPath:
      process.env.IFOOD_SHIPPING_DELIVERY_AREA_PATH?.trim() ||
      '/shipping/v1.0/merchants/{merchantId}/deliveryArea',
  }
}
