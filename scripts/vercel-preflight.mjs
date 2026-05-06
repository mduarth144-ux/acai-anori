/**
 * Verifica se a URL pública está acessível sem estado local (cookies/storage),
 * para evitar surpresas com "403 Forbidden" em ambientes limpos.
 *
 * Uso:
 *   node --env-file=.env scripts/vercel-preflight.mjs
 *   SITE_URL=https://seu-app.vercel.app node scripts/vercel-preflight.mjs
 */

function normalizeBaseUrl(input) {
  const raw = (input || '').trim()
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

async function run() {
  const base =
    normalizeBaseUrl(process.env.SITE_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL)

  if (!base) {
    console.error(
      'Defina SITE_URL ou NEXT_PUBLIC_SITE_URL para rodar o preflight de acesso público.'
    )
    process.exit(1)
  }

  const targets = ['/', '/admin', '/api/tables']
  let hasForbidden = false

  console.log(`Preflight Vercel (sem cookies): ${base}`)

  for (const path of targets) {
    const url = `${base}${path}`
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        headers: {
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          'user-agent': 'cardapio-digital-preflight/1.0',
        },
      })

      const mark = res.status === 403 ? 'FORBIDDEN' : 'ok'
      console.log(`[${mark}] ${res.status} ${url}`)

      if (res.status === 403) hasForbidden = true
    } catch (error) {
      console.error(`[erro] falha ao testar ${url}:`, error)
      process.exit(1)
    }
  }

  if (hasForbidden) {
    console.error(
      '\nDetectado 403 sem sessão local. Revise Deployment Protection/Password Protection na Vercel para o ambiente testado.'
    )
    process.exit(2)
  }

  console.log('\nPreflight concluído: sem 403 nos endpoints verificados.')
}

await run()
