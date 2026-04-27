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
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">Categorias</h1>
      <form onSubmit={onSubmit} className="mb-4 grid gap-2 rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg md:grid-cols-3">
        <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg p-2" placeholder="Nome" />
        <input required value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded-lg p-2" placeholder="Slug" />
        <button type="submit" className="rounded-lg bg-fuchsia-600 p-2 text-white hover:bg-fuchsia-500">Salvar</button>
      </form>
      <div className="space-y-2">{categories.map((c) => <div key={c.id} className="rounded-lg border border-acai-600 bg-acai-900/80 p-3 text-acai-100">{c.name} ({c.slug})</div>)}</div>
    </main>
  )
}
