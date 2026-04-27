import type { Metadata } from 'next'
import Link from 'next/link'
import './global.css'

export const metadata: Metadata = {
  title: 'Anori Acaí Frozen | Cardápio Digital',
  description: 'Cardápio digital para consumo local e pedidos online.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-20 border-b border-fuchsia-100 bg-white/95 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
            <Link href="/" className="font-bold text-fuchsia-900">Anori Acaí Frozen</Link>
            <div className="flex gap-4 text-sm">
              <Link href="/">Cardápio</Link>
              <Link href="/admin">Admin</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
