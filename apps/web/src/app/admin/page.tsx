import Link from 'next/link'

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-950">Admin Anori Acaí Frozen</h1>
      <div className="grid gap-3 md:grid-cols-4">
        <Link href="/admin/pedidos" className="rounded-xl bg-white p-4 shadow">Pedidos</Link>
        <Link href="/admin/produtos" className="rounded-xl bg-white p-4 shadow">Produtos</Link>
        <Link href="/admin/categorias" className="rounded-xl bg-white p-4 shadow">Categorias</Link>
        <Link href="/admin/mesas" className="rounded-xl bg-white p-4 shadow">Mesas / QR</Link>
      </div>
    </main>
  )
}
