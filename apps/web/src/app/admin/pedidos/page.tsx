'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '../../../lib/supabase-client'

type Order = { id: string; status: string; type: string; total: string }

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    fetch('/api/orders').then(async (res) => setOrders(await res.json()))
  }, [])

  useEffect(() => {
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order' }, () => {
        fetch('/api/orders').then(async (res) => setOrders(await res.json()))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function setStatus(id: string, status: string) {
    await fetch(`/api/orders?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const list = await fetch('/api/orders').then((res) => res.json())
    setOrders(list)
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">Pedidos em tempo real</h1>
      <div className="space-y-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
            <p className="text-sm text-acai-400">#{order.id}</p>
            <p className="font-semibold text-acai-100">{order.type} - R$ {Number(order.total).toFixed(2)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'].map((status) => (
                <button key={status} type="button" onClick={() => setStatus(order.id, status)} className="rounded-md border border-acai-600 bg-acai-900 px-3 py-1 text-xs text-fuchsia-200 hover:border-fuchsia-600 hover:bg-acai-800">
                  {status}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
