'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from './BottomNav'
import { SiteHeader } from './SiteHeader'

/**
 * Cardápio público: header + rodapé fixo.
 * Admin: layout próprio (AdminAreaGate) — sem header/rodapé do site para não haver
 * sobreposição de z-index (sticky SiteHeader capturava cliques na nav admin).
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const isAdmin = pathname.startsWith('/admin')

  if (isAdmin) {
    return <>{children}</>
  }

  return (
    <>
      <SiteHeader />
      {children}
      <BottomNav />
    </>
  )
}
