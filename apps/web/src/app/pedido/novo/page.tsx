'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '../../../store/cart-store'

export default function NovoPedidoPage() {
  const router = useRouter()
  const [tableCode, setTableCode] = useState<string | null>(null)
  const cart = useCartStore((state) => state.items)
  const total = useCartStore((state) => state.total)
  const clearCart = useCartStore((state) => state.clearCart)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [type, setType] = useState<'TABLE' | 'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'DEBIT' | 'CREDIT' | 'PIX'>('PIX')
  const [changeFor, setChangeFor] = useState('')

  useEffect(() => {
    const mesa = new URLSearchParams(window.location.search).get('mesa')
    if (mesa) {
      setTableCode(mesa)
      setType('TABLE')
    }
  }, [])

  const change = useMemo(() => {
    const value = Number(changeFor || 0)
    const orderTotal = total()
    if (!value || value < orderTotal) return 0
    return value - orderTotal
  }, [changeFor, total])

  async function submitOrder() {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        tableCode,
        paymentMethod,
        changeFor: paymentMethod === 'CASH' ? Number(changeFor || 0) : undefined,
        customerName,
        customerPhone,
        address: type === 'DELIVERY' ? address : undefined,
        notes,
        items: cart,
      }),
    })

    if (!response.ok) return
    const data = await response.json()
    clearCart()
    router.push(`/pedido/${data.id}`)
  }

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">Finalizar pedido</h1>

      {cart.length > 0 && (
        <div className="mb-4 rounded-2xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">Resumo do pedido</h2>
          <div className="flex flex-col divide-y divide-acai-600">
            {cart.map((item) => {
              const itemTotal =
                (item.unitPrice + (item.choices?.reduce((c: number, x: { priceModifier: number }) => c + x.priceModifier, 0) ?? 0)) *
                item.quantity
              return (
                <div key={item.productId} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-acai-200">
                    <span className="mr-2 font-semibold text-fuchsia-300">{item.quantity}×</span>
                    {item.name}
                  </span>
                  <span className="font-medium text-fuchsia-300">R$ {itemTotal.toFixed(2)}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-acai-600 pt-3">
            <span className="font-bold text-fuchsia-100">Total</span>
            <span className="text-lg font-bold text-fuchsia-300">R$ {total().toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">Seus dados</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-lg p-3" placeholder="Nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="rounded-lg p-3" placeholder="Telefone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>

        <h2 className="mb-3 mt-5 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">Tipo de entrega</h2>
        <select className="w-full rounded-lg p-3" value={type} onChange={(e) => setType(e.target.value as 'TABLE' | 'DELIVERY' | 'PICKUP')}>
          <option value="TABLE">Mesa</option>
          <option value="DELIVERY">Entrega</option>
          <option value="PICKUP">Retirada</option>
        </select>
        {type === 'DELIVERY' ? (
          <textarea className="mt-3 w-full rounded-lg p-3" placeholder="Endereço completo (rua, número, bairro)" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
        ) : null}

        <h2 className="mb-3 mt-5 text-sm font-semibold uppercase tracking-wide text-fuchsia-400">Forma de pagamento</h2>
        <select className="w-full rounded-lg p-3" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'DEBIT' | 'CREDIT' | 'PIX')}>
          <option value="CASH">Dinheiro (na entrega)</option>
          <option value="DEBIT">Débito (na entrega)</option>
          <option value="CREDIT">Crédito (na entrega)</option>
          <option value="PIX">PIX (na entrega)</option>
        </select>
        {paymentMethod === 'CASH' ? (
          <div className="mt-3">
            <input className="w-full rounded-lg p-3" placeholder="Troco para quanto?" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} />
            <p className="mt-2 text-sm text-acai-300">Troco estimado: R$ {change.toFixed(2)}</p>
          </div>
        ) : null}

        <textarea className="mt-5 w-full rounded-lg p-3" placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <button
          onClick={submitOrder}
          className="mt-5 w-full rounded-xl bg-fuchsia-600 py-3 text-base font-semibold text-white shadow hover:bg-fuchsia-500"
        >
          Confirmar pedido
        </button>
      </div>
      <p className="mt-4 text-xs text-acai-400">Preparado para integração futura com provedores de PIX online e marketplaces (iFood/99Food) através do campo externalRefs da entidade Order.</p>
    </main>
  )
}
