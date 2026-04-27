'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center text-acai-100">
      <h1 className="text-xl font-semibold text-fuchsia-200">Erro no servidor</h1>
      <p className="mt-3 text-sm text-acai-300">
        Não foi possível carregar esta página. Em geral isso indica problema de conexão com o banco
        (variáveis <code className="rounded bg-acai-900 px-1">DATABASE_URL</code> /{' '}
        <code className="rounded bg-acai-900 px-1">DIRECT_URL</code> na Vercel) ou URL do pooler
        incompatível com serverless.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-acai-400">Digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 rounded-lg border border-fuchsia-400/40 bg-acai-900 px-4 py-2 text-sm text-fuchsia-200 hover:bg-acai-800"
      >
        Tentar novamente
      </button>
    </main>
  )
}
