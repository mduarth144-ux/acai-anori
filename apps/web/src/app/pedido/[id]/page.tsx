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
      <h1 className="text-2xl font-bold text-fuchsia-100">Acompanhamento do pedido</h1>
      <p className="mt-3 text-sm text-acai-300">Pedido: {orderId}</p>
      <div className="mt-4 rounded-xl border border-acai-600 bg-acai-800/90 p-5">
        <p className="text-sm text-acai-300">Status atual</p>
        <p className="text-3xl font-bold text-fuchsia-400">{status}</p>
      </div>
    </main>
  )
}
