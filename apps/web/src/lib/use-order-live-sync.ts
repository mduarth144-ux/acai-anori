'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_MS = 60_000

export type DeliveryTrackingPayload = {
  ok: boolean
  tracking?: unknown
  fetchedAt?: string
  message?: string
  ifoodOrderId?: string
}

export type OrderLivePayload = {
  id: string
  status: string
  createdAt?: string
  type?: string
  total?: number
  address?: string | null
}

/**
 * Atualização periódica (60s), ao montar, ao voltar ao separador (visibility) e quando `refetch` é chamado.
 */
export function useOrderLiveSync(
  orderId: string | null,
  onOrderUpdate?: (order: OrderLivePayload) => void
) {
  const [delivery, setDelivery] = useState<DeliveryTrackingPayload | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const mounted = useRef(true)
  const onOrderUpdateRef = useRef(onOrderUpdate)
  onOrderUpdateRef.current = onOrderUpdate

  const refetch = useCallback(async (): Promise<OrderLivePayload | null> => {
    if (!orderId) return null
    setSyncError(null)
    let latestOrder: OrderLivePayload | null = null
    try {
      const [orderRes, trRes] = await Promise.all([
        fetch(`/api/orders?id=${encodeURIComponent(orderId)}`),
        fetch(`/api/orders/delivery-tracking?orderId=${encodeURIComponent(orderId)}`),
      ])

      if (orderRes.ok) {
        const o = (await orderRes.json()) as OrderLivePayload
        if (o?.id) {
          latestOrder = o
          onOrderUpdateRef.current?.(o)
        }
      } else {
        setSyncError('Não foi possível atualizar o pedido.')
      }

      const trJson = (await trRes.json().catch(() => ({}))) as DeliveryTrackingPayload
      if (trRes.ok && trJson.ok) {
        setDelivery(trJson)
      } else {
        setDelivery(
          trRes.status === 422
            ? { ok: false, message: trJson.message ?? 'Sem rastreio iFood para este pedido.' }
            : { ok: false, message: trJson.message ?? 'Rastreio indisponível.' }
        )
      }

      setLastSyncedAt(new Date().toISOString())
    } catch {
      if (mounted.current) setSyncError('Falha de rede ao sincronizar.')
    }
    return latestOrder
  }, [orderId])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!orderId) return

    const run = () => {
      void refetch()
    }

    void refetch()
    const id = window.setInterval(run, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [orderId, refetch])

  return { delivery, lastSyncedAt, syncError, refetch }
}
