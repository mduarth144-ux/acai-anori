/** Autenticação temporária só para demonstração ao cliente. Substituir por Supabase depois. */
export const ADMIN_DEMO_STORAGE_KEY = 'anori-admin-demo-session'

export type AdminDemoSession = {
  username: string
  loggedAt: number
}

const DEMO_USER = 'admin'
const DEMO_PASSWORD = '123456'

export function readAdminDemoSession(): AdminDemoSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ADMIN_DEMO_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as AdminDemoSession
    if (data?.username !== DEMO_USER) return null
    return data
  } catch {
    return null
  }
}

export function tryAdminDemoLogin(username: string, password: string): boolean {
  const u = username.trim()
  if (u !== DEMO_USER || password !== DEMO_PASSWORD) return false
  const session: AdminDemoSession = {
    username: DEMO_USER,
    loggedAt: Date.now(),
  }
  localStorage.setItem(ADMIN_DEMO_STORAGE_KEY, JSON.stringify(session))
  return true
}

export function clearAdminDemoSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ADMIN_DEMO_STORAGE_KEY)
}
