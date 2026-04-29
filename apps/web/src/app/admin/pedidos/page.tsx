'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '../../../lib/supabase-client'
import {
  ORDER_STATUS_OPTIONS,
  orderStatusLabel,
  orderTypeLabel,
} from '../../../lib/order-labels'

type Order = { id: string; status: string; type: string; total: string }

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/orders').then(async (res) => setOrders(await res.json()))
  }, [])

  useEffect(() => {
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Order' },
        () => {
          fetch('/api/orders').then(async (res) => setOrders(await res.json()))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function setStatus(id: string, status: string) {
    setSavingOrderId(id)
    setError(null)
    const response = await fetch(`/api/orders?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      setError('Não foi possível atualizar o status do pedido.')
      setSavingOrderId(null)
      return
    }
    const list = await fetch('/api/orders').then((res) => res.json())
    setOrders(list)
    setSavingOrderId(null)
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">
        Pedidos em tempo real
      </h1>
      {error ? <p className="mb-3 text-sm text-amber-400">{error}</p> : null}
      <div className="space-y-3">
        {orders.map((order) => (
          <article
            key={order.id}
            className="border-acai-600 bg-acai-800/90 rounded-xl border p-4 shadow-lg"
          >
            <p className="text-acai-400 text-sm">#{order.id}</p>
            <p className="text-acai-100 font-semibold">
              {orderTypeLabel(order.type)} — R$ {Number(order.total).toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-fuchsia-300">
              Status:{' '}
              <span className="font-medium text-fuchsia-200">
                {orderStatusLabel(order.status)}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ORDER_STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={savingOrderId === order.id || order.status === value}
                  onClick={() => setStatus(order.id, value)}
                  className="border-acai-600 bg-acai-900 hover:bg-acai-800 rounded-md border px-3 py-1 text-xs text-fuchsia-200 hover:border-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
