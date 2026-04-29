import type { Metadata } from 'next'
import { SiteHeader } from '../components/SiteHeader'
import './global.css'

export const metadata: Metadata = {
  title: 'Anori Acaí Frozen | Cardápio Digital',
  description: 'Cardápio digital para consumo local e pedidos online.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  const storageKey = 'app.theme.v1';
  const root = document.documentElement;
  const applyTheme = (theme) => {
    root.classList.toggle('theme-white', theme === 'white');
  };
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'dark' || saved === 'white') {
      applyTheme(saved);
      return;
    }
  } catch {}
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
      return;
    }
  } catch {}
  applyTheme('white');
})();
            `,
          }}
        />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  )
}
