'use client'

import { FormEvent, useEffect, useState } from 'react'

type Category = { id: string; name: string }
type Product = { id: string; name: string; price: number }

export default function AdminProdutosPage() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])

  async function load() {
    const [categoriesResp, productsResp] = await Promise.all([
      fetch('/api/categories').then((res) => res.json()),
      fetch('/api/products').then((res) => res.json()),
    ])
    setCategories(categoriesResp)
    setProducts(productsResp)
    if (!categoryId && categoriesResp.length > 0) setCategoryId(categoriesResp[0].id)
  }

  useEffect(() => { load() }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price: Number(price), categoryId }) })
    setName(''); setPrice('');
    await load()
  }

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-950">Produtos</h1>
      <form onSubmit={onSubmit} className="mb-4 grid gap-2 rounded-xl bg-white p-4 shadow md:grid-cols-4">
        <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded border p-2" placeholder="Nome" />
        <input required value={price} onChange={(e) => setPrice(e.target.value)} className="rounded border p-2" placeholder="Preço" />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded border p-2">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="rounded bg-fuchsia-700 p-2 text-white">Salvar</button>
      </form>
      <div className="space-y-2">{products.map((p) => <div key={p.id} className="rounded bg-fuchsia-50 p-3">{p.name} - R$ {Number(p.price).toFixed(2)}</div>)}</div>
    </main>
  )
}
