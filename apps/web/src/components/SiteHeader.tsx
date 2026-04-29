'use client'

import Link from 'next/link'
import { Camera, HelpCircle, Menu, ShoppingBag, UserCircle2, X } from 'lucide-react'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'

type SavedOrder = { id: string; createdAt: string; status: string; total?: number }
type Profile = { name: string; phone: string; photoDataUrl: string | null }
type DrawerSection = 'menu' | 'help' | 'contact' | 'about' | 'orders' | 'profile'

const PROFILE_STORAGE_KEY = 'app.profile.v1'
const ORDERS_STORAGE_KEY = 'app.orders.v1'

export function SiteHeader() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [section, setSection] = useState<DrawerSection>('menu')
  const [profile, setProfile] = useState<Profile>({
    name: '',
    phone: '',
    photoDataUrl: null,
  })
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([])

  useEffect(() => {
    try {
      const rawProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY)
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile) as Profile
        setProfile({
          name: parsed.name ?? '',
          phone: parsed.phone ?? '',
          photoDataUrl: parsed.photoDataUrl ?? null,
        })
      }
      const rawOrders = window.localStorage.getItem(ORDERS_STORAGE_KEY)
      if (rawOrders) setSavedOrders(JSON.parse(rawOrders) as SavedOrder[])
    } catch {
      // Ignore localStorage issues and keep in-memory defaults.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    } catch {
      // Ignore persistence issues in private mode/quota limits.
    }
  }, [profile])

  const menuItems = useMemo(
    () => [
      { key: 'help' as const, label: 'Ajuda', icon: HelpCircle },
      { key: 'contact' as const, label: 'Contato', icon: UserCircle2 },
      { key: 'about' as const, label: 'Sobre', icon: ShoppingBag },
      { key: 'orders' as const, label: 'Meus pedidos', icon: ShoppingBag },
      { key: 'profile' as const, label: 'Perfil', icon: UserCircle2 },
    ],
    []
  )

  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      setProfile((prev) => ({ ...prev, photoDataUrl: result }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-acai-700 bg-acai-950/90 backdrop-blur supports-[backdrop-filter]:bg-acai-950/80">
        <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link href="/" className="font-bold text-fuchsia-300">
            Anori Acaí Frozen
          </Link>
          <div className="hidden gap-4 text-sm text-acai-200 sm:flex">
            <Link href="/" className="hover:text-fuchsia-300">
              Cardápio
            </Link>
            <Link href="/admin" className="hover:text-fuchsia-300">
              Admin
            </Link>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-acai-600 bg-acai-900 p-2 text-fuchsia-200 sm:hidden"
            onClick={() => {
              setSection('menu')
              setIsDrawerOpen(true)
            }}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </nav>
      </header>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="border-acai-700 bg-acai-950 absolute right-0 top-0 h-full w-[86%] max-w-sm border-l p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-fuchsia-300 font-semibold">Menu</p>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-md border border-acai-600 p-1.5 text-acai-200"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {section === 'menu' ? (
              <div className="space-y-2">
                <Link
                  href="/"
                  onClick={() => setIsDrawerOpen(false)}
                  className="border-acai-700 bg-acai-900/60 block rounded-lg border px-3 py-2 text-acai-100"
                >
                  Cardápio
                </Link>
                <Link
                  href="/admin"
                  onClick={() => setIsDrawerOpen(false)}
                  className="border-acai-700 bg-acai-900/60 block rounded-lg border px-3 py-2 text-acai-100"
                >
                  Admin
                </Link>
                {menuItems.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSection(key)}
                    className="border-acai-700 bg-acai-900/60 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-acai-100"
                  >
                    <Icon className="h-4 w-4 text-fuchsia-300" />
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            {section !== 'menu' ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSection('menu')}
                  className="text-acai-300 text-xs"
                >
                  ← Voltar ao menu
                </button>

                {section === 'help' ? (
                  <div className="border-acai-700 rounded-xl border bg-acai-900/50 p-3 text-sm text-acai-200">
                    Dúvidas frequentes: acompanhe pedidos em "Meus pedidos" e use o
                    campo de observações ao finalizar.
                  </div>
                ) : null}

                {section === 'contact' ? (
                  <div className="border-acai-700 rounded-xl border bg-acai-900/50 p-3 text-sm text-acai-200">
                    Contato: (92) 99999-0000
                    <br />
                    WhatsApp: suporte@anoriacai.com
                  </div>
                ) : null}

                {section === 'about' ? (
                  <div className="border-acai-700 rounded-xl border bg-acai-900/50 p-3 text-sm text-acai-200">
                    Anori Acaí Frozen - plataforma digital para pedidos em mesa,
                    retirada e entrega.
                  </div>
                ) : null}

                {section === 'orders' ? (
                  <div className="space-y-2">
                    {savedOrders.length === 0 ? (
                      <p className="text-acai-300 text-sm">
                        Nenhum pedido salvo neste dispositivo.
                      </p>
                    ) : (
                      savedOrders.map((order) => (
                        <Link
                          key={order.id}
                          href={`/pedido/${order.id}`}
                          onClick={() => setIsDrawerOpen(false)}
                          className="border-acai-700 bg-acai-900/50 block rounded-lg border px-3 py-2"
                        >
                          <p className="text-acai-100 text-sm font-medium">
                            Pedido #{order.id.slice(0, 8)}
                          </p>
                          <p className="text-acai-300 text-xs">
                            {new Date(order.createdAt).toLocaleString('pt-BR')} -{' '}
                            {order.status}
                          </p>
                        </Link>
                      ))
                    )}
                  </div>
                ) : null}

                {section === 'profile' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="border-acai-700 bg-acai-900 relative h-16 w-16 overflow-hidden rounded-full border">
                        {profile.photoDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.photoDataUrl}
                            alt="Foto de perfil"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-acai-400">
                            <UserCircle2 className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <label className="border-acai-600 bg-acai-900 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs text-fuchsia-200">
                        <Camera className="h-3.5 w-3.5" />
                        Subir foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={onPhotoSelected}
                        />
                      </label>
                    </div>
                    <input
                      className="w-full rounded-lg p-3"
                      placeholder="Nome"
                      value={profile.name}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                    <input
                      className="w-full rounded-lg p-3"
                      placeholder="Telefone"
                      value={profile.phone}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                    <p className="text-acai-400 text-xs">
                      Perfil salvo localmente neste dispositivo.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  )
}
