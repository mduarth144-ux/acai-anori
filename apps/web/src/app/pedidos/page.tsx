'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { orderStatusLabel, orderTypeLabel } from '../../lib/order-labels'

type Order = {
  id: string
  status: string
  type: string
  total: number | string
  createdAt: string
}

const PROFILE_STORAGE_KEY = 'app.profile.v1'
const CHECKOUT_PROFILE_STORAGE_KEY = 'checkout.profile.v1'

function formatPhoneDisplay(input: string) {
  const digits = input.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function MeusPedidosPage() {
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const fetchOrders = useCallback(async (nextPhone: string, nextEmail: string, opts?: { silent?: boolean }) => {
    const cleanPhone = nextPhone.trim()
    const cleanEmail = nextEmail.trim().toLowerCase()
    if (!cleanPhone && !cleanEmail) {
      setOrders([])
      setHasSearched(true)
      setError('Informe telefone ou e-mail para buscar seus pedidos.')
      return
    }

    if (!opts?.silent) {
      setLoading(true)
    }
    setError(null)
    try {
      const params = new URLSearchParams()
      if (cleanPhone) params.set('phone', cleanPhone)
      if (cleanEmail) params.set('email', cleanEmail)
      const response = await fetch(`/api/orders?${params.toString()}`)
      if (!response.ok) {
        if (!opts?.silent) setError('Não foi possível buscar seus pedidos agora.')
        setOrders([])
        return
      }
      const data = (await response.json()) as Order[]
      setOrders(data)
    } catch {
      if (!opts?.silent) setError('Falha ao consultar pedidos. Tente novamente.')
      setOrders([])
    } finally {
      setHasSearched(true)
      if (!opts?.silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const rawProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY)
      const rawCheckout = window.localStorage.getItem(CHECKOUT_PROFILE_STORAGE_KEY)
      const profile = rawProfile ? (JSON.parse(rawProfile) as { phone?: string; email?: string }) : {}
      const checkout = rawCheckout
        ? (JSON.parse(rawCheckout) as { customerPhone?: string; customerEmail?: string })
        : {}
      const initialPhone = formatPhoneDisplay(checkout.customerPhone ?? profile.phone ?? '')
      const initialEmail = (checkout.customerEmail ?? profile.email ?? '').trim().toLowerCase()
      setPhone(initialPhone)
      setEmail(initialEmail)
      if (initialPhone || initialEmail) {
        void fetchOrders(initialPhone, initialEmail)
      }
    } catch {
      // Ignore localStorage parse errors and keep manual fields.
    }
  }, [fetchOrders])

  useEffect(() => {
    if (!hasSearched || orders.length === 0) return
    const cleanPhone = phone.trim()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanPhone && !cleanEmail) return
    const tick = () => {
      void fetchOrders(phone, email, { silent: true })
    }
    const id = window.setInterval(tick, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [hasSearched, orders.length, phone, email, fetchOrders])

  return (
    <main className="orders-page mx-auto max-w-3xl p-4">
      <h1 className="orders-title mb-4 text-2xl font-bold text-fuchsia-100">Meus pedidos</h1>

      <div className="orders-search-card border-acai-600 bg-acai-800/90 mb-4 rounded-2xl border p-4 shadow-lg">
        <p className="orders-subtext text-acai-300 mb-3 text-sm">
          Busque pedidos pelo mesmo telefone ou e-mail usados na finalização.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-lg p-3"
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
            inputMode="tel"
          />
          <input
            className="rounded-lg p-3"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoComplete="email"
          />
        </div>
        <button
          type="button"
          onClick={() => void fetchOrders(phone, email)}
          disabled={loading}
          className="mt-3 rounded-xl bg-fuchsia-600 px-4 py-2 font-semibold text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Buscando...' : 'Buscar pedidos'}
        </button>
        {error ? <p className="orders-error mt-2 text-sm text-amber-400">{error}</p> : null}
      </div>

      {hasSearched && !loading && orders.length === 0 && !error ? (
        <p className="orders-subtext text-acai-300 text-sm">Nenhum pedido encontrado para os dados informados.</p>
      ) : null}

      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/pedido/${order.id}`}
            className="orders-item-card block rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 p-4 text-white shadow-lg transition-transform hover:scale-[1.01]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="orders-item-id text-xs font-medium text-fuchsia-100/90">Pedido #{order.id}</p>
                <p className="orders-item-title truncate text-base font-semibold">
                  {orderTypeLabel(order.type)}
                </p>
              </div>
              <p className="shrink-0 text-base font-bold">R$ {Number(order.total).toFixed(2)}</p>
            </div>
            <p className="orders-item-meta mt-1 text-sm text-fuchsia-100/90">
              {new Date(order.createdAt).toLocaleString('pt-BR')} -{' '}
              {orderStatusLabel(order.status)}
            </p>
          </Link>
        ))}
      </div>
    </main>
  )
}
