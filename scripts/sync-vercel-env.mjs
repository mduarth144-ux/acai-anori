/**
 * Envia variáveis do `.env` da raiz para o projeto Vercel ligado (`.vercel/project.json`).
 *
 * Pré-requisitos:
 *   1. `npx vercel login` (se ainda não tiver sessão)
 *   2. `npx vercel link` nesta pasta (liga o repo ao projeto na Vercel)
 *
 * Uso:
 *   node scripts/sync-vercel-env.mjs
 *
 * Ambientes (por omissão: production,development — preview falha em alguns projetos sem branch).
 *   SYNC_VERCEL_ENVS=production,preview,development
 * Preview com branch explícita (ex. main):
 *   VERCEL_PREVIEW_GIT_BRANCH=main SYNC_VERCEL_ENVS=production,preview,development node scripts/sync-vercel-env.mjs
 *
 * Nota: em `development`, a Vercel não aceita --sensitive; o script envia o mesmo valor
 * sem essa flag (limitação da plataforma).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const vercelBin = path.join(root, 'node_modules', 'vercel', 'dist', 'vc.js')

/** @type {{ key: string, sensitive?: boolean }[]} */
const ALLOWLIST = [
  { key: 'DATABASE_URL', sensitive: true },
  { key: 'DIRECT_URL', sensitive: true },
  { key: 'NEXT_PUBLIC_SUPABASE_URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', sensitive: true },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', sensitive: true },
  { key: 'SUPABASE_JWT_SECRET', sensitive: true },
  { key: 'NEXT_PUBLIC_SITE_URL' },
  { key: 'SUPABASE_PROJECT_ID' },
  { key: 'IFOOD_CLIENT_ID', sensitive: true },
  { key: 'IFOOD_CLIENT_SECRET', sensitive: true },
  { key: 'IFOOD_MERCHANT_ID', sensitive: true },
  { key: 'IFOOD_WEBHOOK_SECRET', sensitive: true },
  { key: 'IFOOD_API_BASE_URL' },
  { key: 'IFOOD_AUTH_URL' },
  { key: 'IFOOD_SHIPPING_ENABLED' },
  { key: 'IFOOD_SHIPPING_QUOTE_PATH' },
  { key: 'IFOOD_SHIPPING_ORDER_PATH' },
  { key: 'IFOOD_PICKUP_ADDRESS' },
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

function vercelEnvUpsert(key, vercelTarget, value, sensitive) {
  const previewBranch = process.env.VERCEL_PREVIEW_GIT_BRANCH?.trim()
  const branchSuffix =
    vercelTarget === 'preview' && previewBranch ? [previewBranch] : []

  // Na Vercel, --sensitive só é permitido em production e preview (não em development).
  const allowSensitive = sensitive && vercelTarget !== 'development'

  const run = (args) =>
    spawnSync(process.execPath, args, {
      cwd: root,
      encoding: 'utf8',
      shell: false,
      stdio: 'inherit',
    })

  // Preferir add --force (evita erro da API em update de variável sensitive).
  const addArgs = [vercelBin, 'env', 'add', key, vercelTarget, ...branchSuffix, '--value', value, '--yes', '--force']
  if (allowSensitive) addArgs.push('--sensitive')
  const added = run(addArgs)
  if (added.status === 0) return true

  const updateArgs = [vercelBin, 'env', 'update', key, vercelTarget, ...branchSuffix, '--value', value, '--yes']
  if (allowSensitive) updateArgs.push('--sensitive')
  return run(updateArgs).status === 0
}

const projectJson = path.join(root, '.vercel', 'project.json')
if (!fs.existsSync(projectJson)) {
  console.error('Não há projeto Vercel ligado aqui.')
  console.error('Corre na raiz do monorepo:  npx vercel link')
  process.exit(1)
}

const envPath = path.join(root, '.env')
const parsed = parseEnvFile(envPath)

const targets = (
  process.env.SYNC_VERCEL_ENVS || 'production,development'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (targets.includes('preview') && !process.env.VERCEL_PREVIEW_GIT_BRANCH?.trim()) {
  console.error(
    'Para ambiente preview, define VERCEL_PREVIEW_GIT_BRANCH (ex.: main) ou remove preview de SYNC_VERCEL_ENVS.'
  )
  process.exit(1)
}

let ok = 0
let skipped = 0

for (const { key, sensitive } of ALLOWLIST) {
  const value = parsed[key]
  if (value === undefined || value === '') {
    console.warn(`[skip] ${key} — vazio no .env`)
    skipped++
    continue
  }
  if (key === 'NEXT_PUBLIC_SITE_URL' && /localhost|127\.0\.0\.1/i.test(value)) {
    console.warn(
      `[skip] ${key} — valor parece local (${value}). Define na Vercel a URL pública (ex.: https://xxx.vercel.app).`
    )
    skipped++
    continue
  }
  for (const vercelTarget of targets) {
    process.stdout.write(`→ ${key} (${vercelTarget})… `)
    const success = vercelEnvUpsert(key, vercelTarget, value, Boolean(sensitive))
    if (success) {
      console.log('ok')
      ok++
    } else {
      console.log('falhou (ver mensagens acima)')
      process.exit(1)
    }
  }
}

console.log(`\nFeito: ${ok} operações; ${skipped} chaves ignoradas.`)
