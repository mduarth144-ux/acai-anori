'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useCartStore } from '../../store/cart-store'

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  category: { id: string; name: string; slug: string }
}

type Category = { id: string; name: string; slug: string }

type Props = {
  categories: Category[]
  products: Product[]
  tableCode?: string
}

export function MenuPage({ categories, products, tableCode }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const addItem = useCartStore((state) => state.addItem)
  const items = useCartStore((state) => state.items)
  const total = useCartStore((state) => state.total)
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0)

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch = activeCategory === 'all' || product.category.slug === activeCategory
      const queryMatch = product.name.toLowerCase().includes(query.toLowerCase())
      return categoryMatch && queryMatch
    })
  }, [activeCategory, products, query])

  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="mb-6 rounded-2xl bg-gradient-to-r from-fuchsia-700 to-purple-900 p-6 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Anori Acaí Frozen</h1>
            <p className="mt-1 text-sm text-fuchsia-100">Açaí e Açaí Frozen para consumir na loja ou pedir online.</p>
          </div>
          <Image src="/brand/logo.png" alt="Logo Anori Açaí Frozen" width={120} height={120} className="rounded-xl bg-white/90 p-2" />
        </div>
        {tableCode ? <p className="mt-3 text-sm">Pedido em mesa: <b>{tableCode}</b></p> : null}
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <button className={`rounded-full px-4 py-2 text-sm ${activeCategory === 'all' ? 'bg-fuchsia-700 text-white' : 'bg-fuchsia-50 text-fuchsia-900'}`} onClick={() => setActiveCategory('all')}>Todos</button>
        {categories.map((category) => (
          <button key={category.id} className={`rounded-full px-4 py-2 text-sm ${activeCategory === category.slug ? 'bg-fuchsia-700 text-white' : 'bg-fuchsia-50 text-fuchsia-900'}`} onClick={() => setActiveCategory(category.slug)}>{category.name}</button>
        ))}
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" className="mb-6 w-full rounded-xl border border-fuchsia-100 p-3" />

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((product) => (
          <article key={product.id} className="rounded-2xl border border-fuchsia-100 bg-white p-4 shadow-sm">
            <div className="mb-3 h-40 overflow-hidden rounded-xl bg-fuchsia-50">
              {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={600} height={300} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-fuchsia-500">Sem imagem</div>}
            </div>
            <h2 className="text-xl font-semibold text-fuchsia-950">{product.name}</h2>
            <p className="my-2 text-sm text-slate-600">{product.description ?? 'Açaí artesanal com ingredientes selecionados.'}</p>
            <div className="flex items-center justify-between">
              <span className="font-bold text-fuchsia-900">R$ {product.price.toFixed(2)}</span>
              <button
                onClick={() => addItem({ productId: product.id, name: product.name, quantity: 1, unitPrice: product.price, imageUrl: product.imageUrl, description: product.description })}
                className="rounded-lg bg-fuchsia-700 px-3 py-2 text-sm text-white hover:bg-fuchsia-800"
              >
                Adicionar
              </button>
            </div>
          </article>
        ))}
      </div>

      {itemCount > 0 && (
        <div className="sticky bottom-2 mt-8 rounded-2xl bg-purple-950 p-4 text-white shadow-xl">
          <div className="mb-2 flex items-center justify-between text-sm text-fuchsia-200">
            <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'} no pedido</span>
            <span className="font-semibold">R$ {total().toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Link
              href={tableCode ? `/carrinho?mesa=${tableCode}` : '/carrinho'}
              className="flex-1 rounded-lg border border-fuchsia-400 px-4 py-2 text-center text-sm font-medium hover:bg-fuchsia-900"
            >
              Ver pedido
            </Link>
            <Link
              href={tableCode ? `/pedido/novo?mesa=${tableCode}` : '/pedido/novo'}
              className="flex-1 rounded-lg bg-fuchsia-600 px-4 py-2 text-center text-sm font-medium hover:bg-fuchsia-500"
            >
              Finalizar pedido
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
