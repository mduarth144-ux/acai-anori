import Link from 'next/link'

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold text-fuchsia-100">
        Admin Anori Acaí Frozen
      </h1>
      <p className="text-acai-300 mb-6 mt-2 max-w-2xl text-sm">
        Você está em uma área protegida do sistema. Em produção, o acesso será
        validado pelo Supabase; nesta versão de demonstração a sessão permanece
        ativa neste navegador até você clicar em{' '}
        <strong className="text-acai-200 font-medium">Sair</strong>.
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <Link
          href="/admin/pedidos"
          className="border-acai-600 bg-acai-800/90 text-acai-100 hover:bg-acai-700 rounded-xl border p-4 shadow-lg transition hover:border-fuchsia-700"
        >
          Pedidos
        </Link>
        <Link
          href="/admin/produtos"
          className="border-acai-600 bg-acai-800/90 text-acai-100 hover:bg-acai-700 rounded-xl border p-4 shadow-lg transition hover:border-fuchsia-700"
        >
          Produtos
        </Link>
        <Link
          href="/admin/categorias"
          className="border-acai-600 bg-acai-800/90 text-acai-100 hover:bg-acai-700 rounded-xl border p-4 shadow-lg transition hover:border-fuchsia-700"
        >
          Categorias
        </Link>
        <Link
          href="/admin/mesas"
          className="border-acai-600 bg-acai-800/90 text-acai-100 hover:bg-acai-700 rounded-xl border p-4 shadow-lg transition hover:border-fuchsia-700"
        >
          Mesas / QR
        </Link>
      </div>
    </main>
  )
}
