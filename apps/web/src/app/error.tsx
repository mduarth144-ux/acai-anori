'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="text-acai-100 mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-fuchsia-200">
        Erro no servidor
      </h1>
      <p className="text-acai-300 mt-3 text-sm">
        Não foi possível carregar esta página. Em geral isso indica problema de
        conexão com o banco (variáveis{' '}
        <code className="bg-acai-900 rounded px-1">DATABASE_URL</code> /{' '}
        <code className="bg-acai-900 rounded px-1">DIRECT_URL</code> na Vercel).
        Em Supabase + Prisma na Vercel, use o host do Connect (ex.{' '}
        <code className="bg-acai-900 rounded px-1">aws-1-us-west-2.pooler…</code>
        ){' '}
        com utilizador{' '}
        <code className="bg-acai-900 rounded px-1">
          postgres.seu-project-ref
        </code>{' '}
        (strings em Connect → ORM Prisma).
      </p>
      {error.digest ? (
        <p className="text-acai-400 mt-4 font-mono text-xs">
          Digest: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="bg-acai-900 hover:bg-acai-800 mt-8 rounded-lg border border-fuchsia-400/40 px-4 py-2 text-sm text-fuchsia-200"
      >
        Tentar novamente
      </button>
    </main>
  )
}
