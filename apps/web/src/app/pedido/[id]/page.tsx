'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '../../../lib/supabase-client'
import { orderStatusLabel } from '../../../lib/order-labels'

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
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold text-fuchsia-100">
        Acompanhamento do pedido
      </h1>
      <p className="text-acai-300 mt-3 text-sm">Pedido: {orderId}</p>
      <div className="border-acai-600 bg-acai-800/90 mt-4 rounded-xl border p-5">
        <p className="text-acai-300 text-sm">Status atual</p>
        <p className="text-3xl font-bold text-fuchsia-400">
          {orderStatusLabel(status)}
        </p>
      </div>
    </main>
  )
}
