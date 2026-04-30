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
      <main className="cart-page mx-auto max-w-2xl p-4">
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <ShoppingBag className="h-16 w-16 text-fuchsia-400/60" />
          <h1 className="cart-title text-2xl font-bold text-fuchsia-100">Seu pedido está vazio</h1>
          <p className="cart-muted text-acai-300">Adicione itens do cardápio para continuar.</p>
          <Link
            href={menuHref}
            className="mt-2 rounded-xl bg-fuchsia-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-fuchsia-500"
          >
            Voltar ao cardápio
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="cart-page mx-auto max-w-2xl p-4 pb-[calc(14rem+env(safe-area-inset-bottom))]">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-xl p-2 text-fuchsia-300 hover:bg-acai-800"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="cart-title text-2xl font-bold text-fuchsia-100">Seu pedido</h1>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const itemId = item.id ?? item.productId
          const itemTotal =
            (item.unitPrice + (item.choices?.reduce((c, x) => c + x.priceModifier, 0) ?? 0)) *
            item.quantity

          return (
            <div
              key={itemId}
              className="cart-item-card flex gap-4 rounded-2xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg shadow-black/20"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-acai-900">
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
                    <ShoppingBag className="h-8 w-8 text-acai-500" />
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="cart-item-title font-semibold text-fuchsia-100">{item.name}</h2>
                  <button
                    onClick={() => removeItem(itemId)}
                    className="shrink-0 rounded-lg p-1 text-acai-400 hover:bg-red-950/50 hover:text-red-400"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {item.description && (
                  <p className="cart-muted text-xs text-acai-300 line-clamp-2">{item.description}</p>
                )}

                {item.choices && item.choices.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.choices.map((c, i) => (
                      <span key={i} className="cart-choice rounded-full border border-acai-600 bg-acai-900 px-2 py-0.5 text-xs text-fuchsia-200">
                        {c.name}
                        {c.priceModifier !== 0 && ` (+R$ ${c.priceModifier.toFixed(2)})`}
                      </span>
                    ))}
                  </div>
                )}

                {item.notes && (
                  <p className="cart-muted text-xs italic text-acai-400">Obs: {item.notes}</p>
                )}

                <div className="mt-auto flex items-center justify-between">
                  <div className="cart-quantity-control flex items-center gap-2 rounded-xl border border-acai-600 bg-acai-900/80 p-1">
                    <button
                      onClick={() => updateQuantity(itemId, item.quantity - 1)}
                      className="cart-quantity-button flex h-7 w-7 items-center justify-center rounded-lg text-fuchsia-300 hover:bg-acai-800 disabled:opacity-30"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="cart-quantity-value min-w-[1.5rem] text-center text-sm font-semibold text-fuchsia-100">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(itemId, item.quantity + 1)}
                      className="cart-quantity-button flex h-7 w-7 items-center justify-center rounded-lg text-fuchsia-300 hover:bg-acai-800"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="cart-item-price font-bold text-fuchsia-300">R$ {itemTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40">
        <div className="w-full">
          <div className="cart-summary rounded-t-2xl border border-b-0 border-acai-600 bg-gradient-to-r from-[#2b0f2c] via-[#4a3545] to-[#2b0f2c] p-4 text-acai-50 shadow-2xl ring-1 ring-[#4a3545]/50">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-purple-100/90">
                Total do pedido ({items.length} {items.length === 1 ? 'item' : 'itens'})
              </span>
              <span className="text-xl font-bold">R$ {total().toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={menuHref}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-acai-100/40 bg-acai-50/5 px-3 text-center text-sm font-semibold text-acai-50 transition hover:bg-acai-50/15"
              >
                Adicionar mais itens
              </Link>
              <Link
                href={checkoutHref}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#6f4f68] px-3 text-center text-sm font-semibold text-white transition hover:bg-[#7c5a74]"
              >
                Finalizar pedido
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
