import type { Metadata } from 'next'
import { SiteHeader } from '../components/SiteHeader'
import './global.css'

export const metadata: Metadata = {
  title: 'Anori Acaí Frozen | Cardápio Digital',
  description: 'Cardápio digital para consumo local e pedidos online.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  )
}
