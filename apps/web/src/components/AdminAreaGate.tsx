'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Layers3, Package, QrCode } from 'lucide-react'
import {
  clearAdminDemoSession,
  readAdminDemoSession,
  tryAdminDemoLogin,
} from '../lib/admin-demo-auth'

export function AdminAreaGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [phase, setPhase] = useState<'loading' | 'guest' | 'authed'>('loading')
  const [user, setUser] = useState('admin')
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPhase(readAdminDemoSession() ? 'authed' : 'guest')
  }, [])

  function onLogout() {
    clearAdminDemoSession()
    setPass('')
    setError(null)
    setPhase('guest')
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (tryAdminDemoLogin(user, pass)) {
      setPhase('authed')
      setPass('')
      return
    }
    setError('Usuário ou senha incorretos.')
  }

  if (phase === 'loading') {
    return (
      <div className="bg-acai-950 flex min-h-[70vh] items-center justify-center">
        <div
          className="border-acai-600 h-10 w-10 animate-spin rounded-full border-2 border-t-fuchsia-500"
          aria-hidden
        />
        <span className="sr-only">Carregando…</span>
      </div>
    )
  }

  if (phase === 'guest') {
    return (
      <div className="bg-acai-950 relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(192, 38, 211, 0.25), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(74, 53, 69, 0.6), transparent)',
          }}
        />
        <div className="relative mx-auto w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400/90">
              Anori Açaí Frozen
            </p>
            <h1 className="text-acai-50 mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              Área administrativa
            </h1>
            <p className="text-acai-300 mt-2 text-sm">
              Acesso restrito ao painel de gestão do cardápio e pedidos.
            </p>
          </div>

          <div className="border-acai-600/80 bg-acai-900/70 rounded-2xl border p-8 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md">
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="admin-demo-user"
                  className="text-acai-200 mb-1.5 block text-sm font-medium"
                >
                  Usuário
                </label>
                <input
                  id="admin-demo-user"
                  name="username"
                  autoComplete="username"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  className="border-acai-600 bg-acai-950/80 text-acai-50 w-full rounded-xl px-4 py-3 shadow-inner"
                  placeholder="admin"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-demo-pass"
                  className="text-acai-200 mb-1.5 block text-sm font-medium"
                >
                  Senha
                </label>
                <input
                  id="admin-demo-pass"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="border-acai-600 bg-acai-950/80 text-acai-50 w-full rounded-xl px-4 py-3 shadow-inner"
                  placeholder="••••••"
                />
              </div>

              {error ? (
                <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-700 to-fuchsia-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/40 transition hover:from-fuchsia-600 hover:to-fuchsia-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
              >
                Entrar no painel
              </button>
            </form>

            <p className="border-acai-700/80 text-acai-400 mt-6 border-t pt-5 text-center text-xs leading-relaxed">
              Demonstração para apresentação: use o usuário{' '}
              <span className="text-acai-200 font-mono">admin</span> e a senha{' '}
              <span className="text-acai-200 font-mono">123456</span>. Em
              produção, o login será integrado ao Supabase.
            </p>
          </div>

          <p className="mt-8 text-center">
            <Link
              href="/"
              className="text-acai-400 text-sm underline-offset-4 hover:text-fuchsia-300 hover:underline"
            >
              ← Voltar ao cardápio
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-acai-950 min-h-[calc(100vh-4rem)]">
      <div className="border-acai-800 bg-acai-900/80 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-acai-100 truncate text-sm font-semibold">
              Painel administrativo
            </span>
            <span className="shrink-0 rounded-full border border-fuchsia-800/60 bg-fuchsia-950/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fuchsia-200/90">
              sessão demonstração
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="border-acai-600 bg-acai-950 text-acai-100 hover:bg-acai-800 shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition hover:border-fuchsia-700 hover:text-fuchsia-100"
          >
            Sair
          </button>
        </div>
      </div>
      <nav className="border-acai-800/80 bg-acai-900/60 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5">
          {[
            { href: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
            { href: '/admin/produtos', label: 'Produtos', icon: Package },
            { href: '/admin/categorias', label: 'Categorias', icon: Layers3 },
            { href: '/admin/mesas', label: 'Mesas / QR', icon: QrCode },
          ].map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition',
                  isActive
                    ? 'border-fuchsia-600/80 bg-fuchsia-900/40 text-fuchsia-100'
                    : 'border-acai-700 bg-acai-900 text-acai-200 hover:border-fuchsia-700 hover:text-fuchsia-100',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
      <div className="mx-auto w-full max-w-6xl p-4">{children}</div>
    </div>
  )
}
