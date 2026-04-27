import type { Metadata } from 'next'
import Link from 'next/link'
import './global.css'

export const metadata: Metadata = {
  title: 'Anori Acaí Frozen | Cardápio Digital',
  description: 'Cardápio digital para consumo local e pedidos online.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <header className="sticky top-0 z-20 border-b border-acai-700 bg-acai-950/90 backdrop-blur supports-[backdrop-filter]:bg-acai-950/80">
          <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
            <Link href="/" className="font-bold text-fuchsia-300">Anori Acaí Frozen</Link>
            <div className="flex gap-4 text-sm text-acai-200">
              <Link href="/" className="hover:text-fuchsia-300">Cardápio</Link>
              <Link href="/admin" className="hover:text-fuchsia-300">Admin</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
