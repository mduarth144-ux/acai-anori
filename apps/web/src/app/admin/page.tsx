import Link from 'next/link'

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">Admin Anori Acaí Frozen</h1>
      <div className="grid gap-3 md:grid-cols-4">
        <Link href="/admin/pedidos" className="rounded-xl border border-acai-600 bg-acai-800/90 p-4 text-acai-100 shadow-lg transition hover:border-fuchsia-700 hover:bg-acai-700">Pedidos</Link>
        <Link href="/admin/produtos" className="rounded-xl border border-acai-600 bg-acai-800/90 p-4 text-acai-100 shadow-lg transition hover:border-fuchsia-700 hover:bg-acai-700">Produtos</Link>
        <Link href="/admin/categorias" className="rounded-xl border border-acai-600 bg-acai-800/90 p-4 text-acai-100 shadow-lg transition hover:border-fuchsia-700 hover:bg-acai-700">Categorias</Link>
        <Link href="/admin/mesas" className="rounded-xl border border-acai-600 bg-acai-800/90 p-4 text-acai-100 shadow-lg transition hover:border-fuchsia-700 hover:bg-acai-700">Mesas / QR</Link>
      </div>
    </main>
  )
}
