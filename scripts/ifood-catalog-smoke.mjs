/**
 * Smoke test Catalog v2 — lista catálogos do merchant (Merchant API).
 *
 * Uso (na raiz do monorepo cardapio-digital):
 *   node --env-file=apps/web/.env scripts/ifood-catalog-smoke.mjs
 *
 * Variáveis: IFOOD_CLIENT_ID, IFOOD_CLIENT_SECRET, IFOOD_MERCHANT_ID
 */
import process from 'node:process'

const AUTH_URL =
  process.env.IFOOD_AUTH_URL?.trim() ||
  'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token'
const API = process.env.IFOOD_API_BASE_URL?.trim() || 'https://merchant-api.ifood.com.br'
const merchantId = process.env.IFOOD_MERCHANT_ID?.trim()
const clientId = process.env.IFOOD_CLIENT_ID?.trim()
const clientSecret = process.env.IFOOD_CLIENT_SECRET?.trim()

async function getToken() {
  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId,
    clientSecret,
  })
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  if (!data.accessToken) throw new Error('No accessToken')
  return data.accessToken
}

async function main() {
  if (!merchantId || !clientId || !clientSecret) {
    console.error('Defina IFOOD_MERCHANT_ID, IFOOD_CLIENT_ID, IFOOD_CLIENT_SECRET')
    process.exit(1)
  }
  const token = await getToken()
  const url = `${API}/catalog/v2.0/merchants/${encodeURIComponent(merchantId)}/catalogs`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(res.status, text)
    process.exit(1)
  }
  console.log('OK', url)
  try {
    const json = JSON.parse(text)
    console.log(JSON.stringify(json, null, 2).slice(0, 8000))
  } catch {
    console.log(text.slice(0, 2000))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
