/**
 * Remove e volta a criar variáveis de ambiente **não secretas** na Vercel
 * (Production por omissão) **sem** a flag Sensitive.
 *
 * Use quando o painel mostrar "Sensitive" em flags/paths que não são credenciais.
 *
 *   SYNC_VERCEL_ENVS=production node scripts/vercel-resync-plain-env.mjs
 *
 * Chaves tratadas: ver PLAIN_KEYS abaixo (alinhadas a sync-vercel-env.mjs).
 *
 * Timeout por comando: VERCEL_CMD_TIMEOUT_MS (default 90000), ver scripts/vercel-cmd.mjs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { vercelSpawn } from './vercel-cmd.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const vercelBin = path.join(root, 'node_modules', 'vercel', 'dist', 'vc.js')

/** Chaves que no código são configuração pública ou operacional — não usar --sensitive. */
const PLAIN_KEYS = [
  'IFOOD_ORDER_API_ON_CREATE',
  'IFOOD_ORDER_USE_DEDICATED_ENDPOINTS',
  'IFOOD_EVENTS_POLLING_ENABLED',
  'IFOOD_EVENTS_POLLING_CATEGORIES',
  'IFOOD_PICKUP_ADDRESS',
  'IFOOD_SHIPPING_QUOTE_PATH',
  'IFOOD_SHIPPING_ORDER_PATH',
  'IFOOD_API_BASE_URL',
  'IFOOD_AUTH_URL',
  'IFOOD_SHIPPING_ENABLED',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_PROJECT_ID',
  'IFOOD_DEFAULT_CANCEL_CODE',
]

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('Ficheiro não encontrado:', filePath)
    process.exit(1)
  }
  const out = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function runVercel(argv, label) {
  return vercelSpawn({ root, vercelBin, argv, label })
}

const projectJson = path.join(root, '.vercel', 'project.json')
if (!fs.existsSync(projectJson)) {
  console.error('Corre antes: npx vercel link')
  process.exit(1)
}

const envPath = path.join(root, '.env')
const parsed = parseEnvFile(envPath)

const only = process.env.ONLY_KEYS?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const keys = only?.length ? PLAIN_KEYS.filter((k) => only.includes(k)) : PLAIN_KEYS

const targets = (process.env.SYNC_VERCEL_ENVS || 'production')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

let planned = 0
for (const key of keys) {
  const value = parsed[key]
  if (value === undefined || value === '') continue
  if (key === 'NEXT_PUBLIC_SITE_URL' && /localhost|127\.0\.0\.1/i.test(value)) continue
  planned += 2 * targets.length
}
console.error(
  `\n[vercel-resync-plain-env] até ${planned} chamadas (rm+add por chave; timeout ${process.env.VERCEL_CMD_TIMEOUT_MS || '90000'}ms cada).\n`
)

for (const key of keys) {
  const value = parsed[key]
  if (value === undefined || value === '') {
    console.warn(`[skip] ${key} — vazio no .env`)
    continue
  }
  if (key === 'NEXT_PUBLIC_SITE_URL' && /localhost|127\.0\.0\.1/i.test(value)) {
    console.warn(`[skip] ${key} — localhost; define URL de produção no .env antes.`)
    continue
  }
  for (const target of targets) {
    console.log(`\n→ ${key} (${target}) — rm + add (plain)`)
    runVercel(['env', 'rm', key, target, '--yes'], `rm ${key}@${target}`)
    const add = runVercel(
      ['env', 'add', key, target, '--value', value, '--yes', '--force'],
      `add ${key}@${target}`
    )
    if (add.status !== 0) {
      console.error(`Falhou em ${key} (${target})`)
      process.exit(1)
    }
  }
}

console.log('\nFeito: variáveis plain recriadas (sem --sensitive).')
