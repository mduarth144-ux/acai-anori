'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { createSupabaseClient } from '../../../lib/supabase-client'
import { orderStatusLabel } from '../../../lib/order-labels'
import { useOrderLiveSync } from '../../../lib/use-order-live-sync'
import {
  getStoredDeliveryConfirmToken,
  persistDeliveryConfirmToken,
} from '../../../lib/order-delivery-confirm-client'

type Props = { params: Promise<{ id: string }> }
type OrderData = {
  id: string
  status: string
  createdAt?: string
  type?: string
  total?: number
  address?: string | null
}

const TIMELINE = [
  { id: 'PENDING', label: 'Pedido recebido' },
  { id: 'PREPARING', label: 'Pedido em preparo' },
  { id: 'READY', label: 'Saiu para entrega' },
  { id: 'DELIVERED', label: 'Entregue' },
] as const

export default function PedidoStatusPage({ params }: Props) {
  const [orderId, setOrderId] = useState('')
  const [order, setOrder] = useState<OrderData | null>(null)
  const [status, setStatus] = useState('PENDING')
  const [deliveryConfirmToken, setDeliveryConfirmToken] = useState<string | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    params.then((p) => setOrderId(p.id))
  }, [params])

  useEffect(() => {
    if (!orderId || typeof window === 'undefined') return
    const query = new URLSearchParams(window.location.search)
    const c = query.get('c')
    if (c) {
      persistDeliveryConfirmToken(orderId, c)
      setDeliveryConfirmToken(c)
      window.history.replaceState(null, '', `/pedido/${orderId}`)
      return
    }
    setDeliveryConfirmToken(getStoredDeliveryConfirmToken(orderId))
  }, [orderId])

  const applyOrderFromServer = useCallback((found: OrderData) => {
    setOrder(found)
    setStatus(String(found.status ?? 'PENDING'))
    setDeliveryConfirmToken((prev) => prev ?? getStoredDeliveryConfirmToken(found.id))
  }, [])

  const { delivery, lastSyncedAt, syncError: pollError, refetch } = useOrderLiveSync(
    orderId || null,
    applyOrderFromServer
  )

  useEffect(() => {
    if (!orderId) return
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Order',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setStatus(String(payload.new.status))
          setOrder((prev) =>
            prev
              ? { ...prev, status: String(payload.new.status) }
              : ({
                  id: orderId,
                  status: String(payload.new.status),
                } as OrderData)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  const confirmReceived = useCallback(async () => {
    if (!orderId || !deliveryConfirmToken) return
    setConfirmLoading(true)
    setConfirmError(null)
    try {
      const response = await fetch('/api/orders/customer-confirm-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token: deliveryConfirmToken }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        setConfirmError(payload.message ?? 'Nao foi possivel registrar a entrega.')
        return
      }
      setStatus('DELIVERED')
      setOrder((prev) => (prev ? { ...prev, status: 'DELIVERED' } : prev))
    } catch {
      setConfirmError('Erro de conexao. Tente novamente.')
    } finally {
      setConfirmLoading(false)
    }
  }, [orderId, deliveryConfirmToken])

  const showCustomerConfirmDelivery =
    order?.type === 'DELIVERY' &&
    status === 'READY' &&
    Boolean(deliveryConfirmToken)

  const currentIndex = (() => {
    if (status === 'CONFIRMED') return 1
    if (status === 'CANCELLED') return 0
    return Math.max(
      TIMELINE.findIndex((step) => step.id === status),
      0
    )
  })()
  const createdAtDate = order?.createdAt ? new Date(order.createdAt) : null
  const etaMinutes =
    status === 'DELIVERED' ? 0 : status === 'READY' ? 8 : status === 'PREPARING' ? 20 : 35
  const eta = createdAtDate
    ? new Date(createdAtDate.getTime() + etaMinutes * 60_000)
    : null

  return (
    <main className="order-status-page mx-auto max-w-2xl p-4 pb-[calc(14rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="order-status-title text-2xl font-bold text-fuchsia-100">
          Acompanhamento do pedido
        </h1>
        <button
          type="button"
          onClick={() => void refetch()}
          className="border-acai-500 bg-acai-900/80 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-fuchsia-200 transition hover:border-fuchsia-500 hover:bg-acai-800"
          title="Atualizar pedido e rastreio iFood"
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
          Atualizar
        </button>
      </div>
      <p className="order-status-subtitle text-acai-300 mt-3 text-sm">Pedido: {orderId}</p>
      {lastSyncedAt ? (
        <p className="text-acai-500 mt-1 text-[11px]">
          Última sincronização:{' '}
          {new Date(lastSyncedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      ) : null}
      {pollError ? <p className="mt-1 text-xs text-amber-400">{pollError}</p> : null}
      <div className="order-status-card border-acai-600 bg-acai-800/90 mt-4 space-y-4 rounded-xl border p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="order-status-label text-acai-300 text-sm">Status atual</p>
            <p className="order-status-value text-3xl font-bold text-fuchsia-400">
              {orderStatusLabel(status)}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="order-status-label text-acai-300 text-sm">Previsão de entrega</p>
            <p className="order-status-eta text-xl font-semibold text-acai-100">
              {status === 'DELIVERED'
                ? 'Pedido finalizado'
                : eta
                  ? eta.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Calculando...'}
            </p>
            {etaMinutes > 0 && status !== 'DELIVERED' ? (
              <p className="order-status-muted text-acai-400 text-xs">aprox. {etaMinutes} min</p>
            ) : null}
          </div>
        </div>

        <div className="order-status-timeline border-acai-700 rounded-xl border bg-acai-900/50 p-3">
          <p className="order-status-muted text-acai-300 mb-3 text-xs uppercase tracking-wide">
            Timeline do pedido
          </p>
          <ol className="space-y-3">
            {TIMELINE.map((step, index) => {
              const done = index <= currentIndex
              const active = index === currentIndex
              return (
                <li key={step.id} className="flex items-start gap-3">
                  <span
                    className={[
                      'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                      done
                        ? 'border-fuchsia-500 bg-fuchsia-600 text-white'
                        : 'border-acai-600 bg-acai-900 text-acai-400',
                    ].join(' ')}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p
                      className={[
                        'text-sm',
                        done ? 'text-acai-100' : 'text-acai-400',
                        active ? 'font-semibold text-fuchsia-300' : '',
                      ].join(' ')}
                    >
                      {step.label}
                    </p>
                    {active ? (
                      <p className="order-status-current text-xs text-fuchsia-300/90">Etapa atual</p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {delivery?.ok && delivery.tracking != null ? (
          <div className="border-acai-600 bg-acai-900/40 rounded-lg border p-3">
            <p className="text-acai-300 mb-1 text-xs font-medium uppercase tracking-wide">
              Rastreio da entrega (iFood)
            </p>
            <p className="text-acai-400 font-mono text-[11px] leading-relaxed break-all">
              {typeof delivery.tracking === 'object'
                ? JSON.stringify(delivery.tracking).slice(0, 420)
                : String(delivery.tracking)}
              {typeof delivery.tracking === 'object' &&
              JSON.stringify(delivery.tracking).length > 420
                ? '…'
                : ''}
            </p>
          </div>
        ) : delivery && !delivery.ok && order?.type === 'DELIVERY' ? (
          <p className="text-acai-500 text-[11px]">{delivery.message}</p>
        ) : null}

        {order?.total ? (
          <p className="order-status-muted text-acai-300 text-sm">
            Total: R$ {Number(order.total).toFixed(2)}
          </p>
        ) : null}
        {order?.address ? (
          <p className="order-status-muted text-acai-300 text-sm">Entrega em: {order.address}</p>
        ) : null}

        {showCustomerConfirmDelivery ? (
          <div className="border-fuchsia-700/50 bg-fuchsia-950/30 rounded-xl border p-4">
            <p className="text-acai-100 mb-2 text-sm font-medium">Ja recebeu o pedido?</p>
            <p className="text-acai-400 mb-3 text-xs">
              Se o status nao atualizar sozinho (por exemplo, se o entregador estiver sem internet),
              voce pode confirmar aqui que o pedido chegou ate voce.
            </p>
            {confirmError ? (
              <p className="text-amber-300 mb-2 text-xs">{confirmError}</p>
            ) : null}
            <button
              type="button"
              disabled={confirmLoading}
              onClick={() => void confirmReceived()}
              className="w-full rounded-lg bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirmLoading ? 'Registrando…' : 'Confirmar que recebi o pedido'}
            </button>
          </div>
        ) : null}
      </div>
      <div className="fixed inset-x-0 bottom-16 z-40">
        <div className="w-full">
          <footer className="rounded-t-2xl border border-b-0 border-acai-600 bg-gradient-to-r from-[#2b0f2c] via-[#4a3545] to-[#2b0f2c] p-4 text-acai-50 shadow-2xl ring-1 ring-[#4a3545]/50">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-purple-100/90">Pedido {orderId || '--'}</span>
              <span className="text-sm font-semibold text-acai-50">{orderStatusLabel(status)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/ajuda"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-acai-100/40 bg-acai-50/5 px-3 text-base font-semibold text-acai-50 transition hover:bg-acai-50/15"
              >
                Ajuda
              </Link>
              <Link
                href="/"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#6f4f68] px-3 text-base font-semibold text-white shadow transition hover:bg-[#7c5a74]"
              >
                Voltar ao início
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}
