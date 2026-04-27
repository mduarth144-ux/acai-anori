'use client'

import { FormEvent, useEffect, useState } from 'react'

type Category = { id: string; name: string; slug: string }

export default function AdminCategoriasPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [categories, setCategories] = useState<Category[]>([])

  async function load() {
    setCategories(await fetch('/api/categories').then((res) => res.json()))
  }

  useEffect(() => { load() }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, slug }) })
    setName(''); setSlug('')
    await load()
  }

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-950">Categorias</h1>
      <form onSubmit={onSubmit} className="mb-4 grid gap-2 rounded-xl bg-white p-4 shadow md:grid-cols-3">
        <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded border p-2" placeholder="Nome" />
        <input required value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded border p-2" placeholder="Slug" />
        <button className="rounded bg-fuchsia-700 p-2 text-white">Salvar</button>
      </form>
      <div className="space-y-2">{categories.map((c) => <div key={c.id} className="rounded bg-fuchsia-50 p-3">{c.name} ({c.slug})</div>)}</div>
    </main>
  )
}
