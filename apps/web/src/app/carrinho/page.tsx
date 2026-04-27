'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react'
import { useCartStore } from '../../store/cart-store'

export default function CarrinhoPage() {
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const total = useCartStore((state) => state.total)
  const removeItem = useCartStore((state) => state.removeItem)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const [tableCode, setTableCode] = useState<string | null>(null)

  useEffect(() => {
    const mesa = new URLSearchParams(window.location.search).get('mesa')
    if (mesa) setTableCode(mesa)
  }, [])

  const checkoutHref = tableCode ? `/pedido/novo?mesa=${tableCode}` : '/pedido/novo'
  const menuHref = tableCode ? `/mesa/${tableCode}` : '/'

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <ShoppingBag className="h-16 w-16 text-fuchsia-200" />
          <h1 className="text-2xl font-bold text-fuchsia-950">Seu pedido está vazio</h1>
          <p className="text-slate-500">Adicione itens do cardápio para continuar.</p>
          <Link
            href={menuHref}
            className="mt-2 rounded-xl bg-fuchsia-700 px-6 py-3 text-sm font-medium text-white hover:bg-fuchsia-800"
          >
            Voltar ao cardápio
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-xl p-2 text-fuchsia-700 hover:bg-fuchsia-50"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-fuchsia-950">Seu pedido</h1>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const itemTotal =
            (item.unitPrice + (item.choices?.reduce((c, x) => c + x.priceModifier, 0) ?? 0)) *
            item.quantity

          return (
            <div
              key={item.productId}
              className="flex gap-4 rounded-2xl border border-fuchsia-100 bg-white p-4 shadow-sm"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-fuchsia-50">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-fuchsia-200" />
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-fuchsia-950">{item.name}</h2>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {item.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                )}

                {item.choices && item.choices.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.choices.map((c, i) => (
                      <span key={i} className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs text-fuchsia-700">
                        {c.name}
                        {c.priceModifier !== 0 && ` (+R$ ${c.priceModifier.toFixed(2)})`}
                      </span>
                    ))}
                  </div>
                )}

                {item.notes && (
                  <p className="text-xs italic text-slate-400">Obs: {item.notes}</p>
                )}

                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-xl border border-fuchsia-100 p-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-fuchsia-700 hover:bg-fuchsia-50 disabled:opacity-30"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[1.5rem] text-center text-sm font-semibold text-fuchsia-950">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-fuchsia-700 hover:bg-fuchsia-50"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="font-bold text-fuchsia-900">R$ {itemTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="sticky bottom-2 mt-6 rounded-2xl bg-purple-950 p-4 text-white shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-fuchsia-200">Total do pedido</span>
          <span className="text-xl font-bold">R$ {total().toFixed(2)}</span>
        </div>
        <Link
          href={checkoutHref}
          className="block w-full rounded-xl bg-fuchsia-600 py-3 text-center text-sm font-semibold hover:bg-fuchsia-500"
        >
          Finalizar pedido
        </Link>
      </div>
    </main>
  )
}
