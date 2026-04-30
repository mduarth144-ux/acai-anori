'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ClipboardList, Home, Tag, User } from 'lucide-react'

const baseItemClass =
  'flex flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition hover:text-fuchsia-600'

export function BottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tableCode = searchParams.get('mesa')?.trim()
  const orderHref = tableCode ? `/pedido/novo?mesa=${encodeURIComponent(tableCode)}` : '/pedido/novo'

  const isActive = (path: string) => pathname === path

  return (
    <footer className="fixed inset-x-0 bottom-0 z-[35] border-t border-zinc-200 bg-[#ececef]/95 backdrop-blur supports-[backdrop-filter]:bg-[#ececef]/90">
      <nav className="mx-auto grid h-[calc(4rem+env(safe-area-inset-bottom))] w-full max-w-3xl grid-cols-4 items-center pb-[env(safe-area-inset-bottom)]">
        <Link href="/" className={`${baseItemClass} ${isActive('/') ? 'text-fuchsia-600' : 'text-zinc-500'}`}>
          <Home className="h-5 w-5" />
          <span>Início</span>
        </Link>
        <Link
          href="/promocoes"
          className={`${baseItemClass} ${isActive('/promocoes') ? 'text-fuchsia-600' : 'text-zinc-500'}`}
        >
          <Tag className="h-5 w-5" />
          <span>Promoções</span>
        </Link>
        <Link
          href={orderHref}
          className={`${baseItemClass} ${isActive('/pedido/novo') ? 'text-fuchsia-600' : 'text-zinc-500'}`}
        >
          <ClipboardList className="h-5 w-5" />
          <span>Pedidos</span>
        </Link>
        <Link
          href="/perfil"
          className={`${baseItemClass} ${isActive('/perfil') ? 'text-fuchsia-600' : 'text-zinc-500'}`}
        >
          <User className="h-5 w-5" />
          <span>Perfil</span>
        </Link>
      </nav>
    </footer>
  )
}
