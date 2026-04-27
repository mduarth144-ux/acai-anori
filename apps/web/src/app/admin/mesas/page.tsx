'use client'

import { FormEvent, useEffect, useState } from 'react'

type TableItem = { id: string; number: number; code: string; qrUrl: string }

export default function AdminMesasPage() {
  const [number, setNumber] = useState('')
  const [tables, setTables] = useState<TableItem[]>([])

  async function load() {
    setTables(await fetch('/api/tables').then((res) => res.json()))
  }

  useEffect(() => { load() }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: Number(number) }) })
    setNumber('')
    await load()
  }

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-950">Mesas e QR Codes</h1>
      <form onSubmit={onSubmit} className="mb-4 flex gap-2 rounded-xl bg-white p-4 shadow">
        <input required value={number} onChange={(e) => setNumber(e.target.value)} className="rounded border p-2" placeholder="Número da mesa" />
        <button className="rounded bg-fuchsia-700 px-4 py-2 text-white">Gerar</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        {tables.map((table) => (
          <div key={table.id} className="rounded-xl bg-white p-4 shadow">
            <p className="font-semibold">Mesa {table.number}</p>
            <p className="text-xs text-slate-500">{table.code}</p>
            <img src={table.qrUrl} alt={`QR mesa ${table.number}`} className="mt-2 h-40 w-40" />
          </div>
        ))}
      </div>
    </main>
  )
}
