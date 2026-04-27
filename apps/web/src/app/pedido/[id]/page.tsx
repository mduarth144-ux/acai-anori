'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '../../../lib/supabase-client'

type Props = { params: Promise<{ id: string }> }

export default function PedidoStatusPage({ params }: Props) {
  const [orderId, setOrderId] = useState('')
  const [status, setStatus] = useState('PENDING')

  useEffect(() => {
    params.then((p) => setOrderId(p.id))
  }, [params])

  useEffect(() => {
    if (!orderId) return
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Order', filter: `id=eq.${orderId}` }, (payload) => {
        setStatus(String(payload.new.status))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold text-fuchsia-950">Acompanhamento do pedido</h1>
      <p className="mt-3 text-sm text-slate-600">Pedido: {orderId}</p>
      <div className="mt-4 rounded-xl bg-fuchsia-50 p-5">
        <p className="text-sm text-slate-700">Status atual</p>
        <p className="text-3xl font-bold text-fuchsia-800">{status}</p>
      </div>
    </main>
  )
}
