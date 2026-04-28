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
 * Ambientes (por omissão: production,preview,development):
 *   SYNC_VERCEL_ENVS=production,preview node scripts/sync-vercel-env.mjs
 *
 * Nota: em `development`, a Vercel não aceita --sensitive; o script envia o mesmo valor
 * sem essa flag (limitação da plataforma). Para não gravar segredos em Development,
 * usa SYNC_VERCEL_ENVS=production,preview
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

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

function vercelEnvAdd(key, vercelTarget, value, sensitive) {
  const args = ['vercel', 'env', 'add', key, vercelTarget, '--yes', '--force']
  // Na Vercel, --sensitive só é permitido em production e preview (não em development).
  const allowSensitive = sensitive && vercelTarget !== 'development'
  if (allowSensitive) args.push('--sensitive')
  const r = spawnSync('npx', args, {
    cwd: root,
    input: value,
    encoding: 'utf8',
    shell: true,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  return r.status === 0
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
  process.env.SYNC_VERCEL_ENVS || 'production,preview,development'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

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
    const success = vercelEnvAdd(key, vercelTarget, value, Boolean(sensitive))
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
