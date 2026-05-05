'use client'

import { useEffect, useState } from 'react'

type CheckoutProfile = {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  cepDigits?: string
  street?: string
  number?: string
  neighborhood?: string
}

const CHECKOUT_PROFILE_STORAGE_KEY = 'checkout.profile.v1'

function formatCep(cepDigits?: string) {
  const digits = (cepDigits ?? '').replace(/\D/g, '').slice(0, 8)
  if (digits.length !== 8) return ''
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<CheckoutProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(CHECKOUT_PROFILE_STORAGE_KEY)
      if (!raw) {
        setProfile(null)
        return
      }
      const parsed = JSON.parse(raw) as CheckoutProfile
      setProfile(parsed)
    } catch {
      setLoadError(
        'Nao foi possivel carregar os dados do perfil salvos no aparelho.'
      )
    }
  }, [])

  const addressLine = [profile?.street, profile?.number, profile?.neighborhood]
    .filter((value) => value && value.trim().length > 0)
    .join(', ')

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <section className="rounded-2xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-fuchsia-100">Perfil</h1>
        <p className="mt-2 text-sm text-acai-200">
          Dados carregados automaticamente do seu navegador.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-acai-600 bg-acai-800/80 p-4 shadow-md">
        {loadError ? (
          <p className="text-sm text-amber-300">{loadError}</p>
        ) : null}

        {!loadError && !profile ? (
          <p className="text-sm text-acai-100">
            Nenhum dado de perfil foi encontrado ainda. Preencha seu cadastro ao finalizar um pedido.
          </p>
        ) : null}

        {!loadError && profile ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-acai-300">Nome</dt>
              <dd className="font-medium text-fuchsia-100">{profile.customerName || '-'}</dd>
            </div>
            <div>
              <dt className="text-acai-300">Telefone</dt>
              <dd className="font-medium text-fuchsia-100">{profile.customerPhone || '-'}</dd>
            </div>
            <div>
              <dt className="text-acai-300">E-mail</dt>
              <dd className="font-medium text-fuchsia-100">{profile.customerEmail || '-'}</dd>
            </div>
            <div>
              <dt className="text-acai-300">Endereco</dt>
              <dd className="font-medium text-fuchsia-100">{addressLine || '-'}</dd>
            </div>
            <div>
              <dt className="text-acai-300">CEP</dt>
              <dd className="font-medium text-fuchsia-100">{formatCep(profile.cepDigits) || '-'}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  )
}
