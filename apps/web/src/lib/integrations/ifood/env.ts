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
    shippingOrderPath: process.env.IFOOD_SHIPPING_ORDER_PATH?.trim() || '/shipping/v1.0/orders',
  }
}
