/**
 * Armazenamento do token de confirmação de entrega no browser (sem secret no cliente).
 */

const SESSION_KEY_PREFIX = 'orderDeliveryConfirm:'
const STORAGE_KEYS = ['app.orders.v1', 'orders.history.v1'] as const

export function sessionDeliveryConfirmKey(orderId: string): string {
  return `${SESSION_KEY_PREFIX}${orderId}`
}

export function getStoredDeliveryConfirmToken(orderId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fromSession = window.sessionStorage.getItem(sessionDeliveryConfirmKey(orderId))
    if (fromSession) return fromSession
    for (const key of STORAGE_KEYS) {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const list = JSON.parse(raw) as Array<{ id: string; deliveryConfirmToken?: string }>
      const hit = list.find((o) => String(o.id) === orderId)
      if (typeof hit?.deliveryConfirmToken === 'string' && hit.deliveryConfirmToken.length > 0) {
        return hit.deliveryConfirmToken
      }
    }
  } catch {
    // ignore
  }
  return null
}

export function persistDeliveryConfirmToken(orderId: string, token: string | null | undefined): void {
  if (typeof window === 'undefined' || !token) return
  try {
    window.sessionStorage.setItem(sessionDeliveryConfirmKey(orderId), token)
    for (const key of STORAGE_KEYS) {
      const raw = window.localStorage.getItem(key)
      const list = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : []
      let changed = false
      const next = list.map((entry) => {
        if (String(entry.id) !== orderId) return entry
        changed = true
        return { ...entry, deliveryConfirmToken: token }
      })
      if (changed) {
        window.localStorage.setItem(key, JSON.stringify(next))
      }
    }
  } catch {
    // ignore
  }
}
