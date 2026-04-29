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
    <main className="w-full">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">Mesas e QR Codes</h1>
      <form onSubmit={onSubmit} className="mb-4 flex gap-2 rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
        <input required value={number} onChange={(e) => setNumber(e.target.value)} className="flex-1 rounded-lg p-2" placeholder="Número da mesa" />
        <button type="submit" className="rounded-lg bg-fuchsia-600 px-4 py-2 text-white hover:bg-fuchsia-500">Gerar</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        {tables.map((table) => (
          <div key={table.id} className="rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
            <p className="font-semibold text-fuchsia-100">Mesa {table.number}</p>
            <p className="text-xs text-acai-400">{table.code}</p>
            <img src={table.qrUrl} alt={`QR mesa ${table.number}`} className="mt-2 h-40 w-40 rounded-lg bg-white p-1" />
          </div>
        ))}
      </div>
    </main>
  )
}
