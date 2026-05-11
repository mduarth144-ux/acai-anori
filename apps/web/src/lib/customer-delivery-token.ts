import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_VERSION = 1 as const

export function getCustomerOrderActionSecret(): string | null {
  const s = process.env.CUSTOMER_ORDER_ACTION_SECRET?.trim()
  if (!s || s.length < 16) return null
  return s
}

function signPayload(base: string, secret: string): string {
  return createHmac('sha256', secret).update(base, 'utf8').digest('base64url')
}

/** Token opaco para o cliente confirmar recebimento (não colocar em GET público sem cuidado). */
export function createCustomerDeliveryToken(orderId: string): string | null {
  const secret = getCustomerOrderActionSecret()
  if (!secret) return null
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90
  const base = `v${TOKEN_VERSION}|${orderId}|${exp}`
  const sig = signPayload(base, secret)
  return Buffer.from(JSON.stringify({ v: TOKEN_VERSION, orderId, exp, sig }), 'utf8').toString('base64url')
}

export function verifyCustomerDeliveryToken(token: string): { orderId: string } | null {
  const secret = getCustomerOrderActionSecret()
  if (!secret) return null
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as {
      v?: number
      orderId?: string
      exp?: number
      sig?: string
    }
    if (
      parsed.v !== TOKEN_VERSION ||
      typeof parsed.orderId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.sig !== 'string'
    ) {
      return null
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null
    const base = `v${TOKEN_VERSION}|${parsed.orderId}|${parsed.exp}`
    const expected = signPayload(base, secret)
    const a = Buffer.from(parsed.sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    return { orderId: parsed.orderId }
  } catch {
    return null
  }
}
