/**
 * Exercita chamadas à Merchant API (mesmas famílias que o app usa) para o portal
 * contabilizar integrações. Imprime também modelos de `curl` (substitua <TOKEN>).
 *
 * Uso (raiz do repo cardapio-digital, com .env):
 *   node --env-file=.env scripts/ifood-portal-smoke.mjs
 *
 * Opcional:
 *   IFOOD_SMOKE_IFOOD_ORDER_ID=<uuid pedido iFood>  → detalhe do pedido + cancellationReasons
 */
import process from 'node:process'

const AUTH_URL =
  process.env.IFOOD_AUTH_URL?.trim() ||
  'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token'
const API = process.env.IFOOD_API_BASE_URL?.trim() || 'https://merchant-api.ifood.com.br'
const merchantId = process.env.IFOOD_MERCHANT_ID?.trim()
const clientId = process.env.IFOOD_CLIENT_ID?.trim()
const clientSecret = process.env.IFOOD_CLIENT_SECRET?.trim()
const categories = process.env.IFOOD_EVENTS_POLLING_CATEGORIES?.trim() || 'FOOD,GROCERY'
const smokeOrderId = process.env.IFOOD_SMOKE_IFOOD_ORDER_ID?.trim()

function curlModel(method, pathWithQuery, extraHeaders = '') {
  const url = `${API}${pathWithQuery}`
  return `curl -sS -X ${method} '${url}' -H 'Authorization: Bearer <TOKEN>' -H 'Accept: application/json' ${extraHeaders}`.trim()
}

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
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Auth ${res.status}: ${text.slice(0, 400)}`)
  }
  const data = JSON.parse(text)
  if (!data.accessToken) throw new Error('Auth sem accessToken')
  return data.accessToken
}

async function api(token, method, path, init = {}) {
  const url = `${API}${path}`
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...init.headers,
  }
  return fetch(url, { method, headers, body: init.body })
}

function preview(text, n = 600) {
  const t = text.length > n ? `${text.slice(0, n)}…` : text
  return t.replace(/Bearer [^\s'"]+/gi, 'Bearer <redacted>')
}

async function runStep(title, curlHint, fn) {
  console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`)
  console.log('Modelo curl:\n', curlHint, '\n')
  try {
    const res = await fn()
    const text = await res.text()
    console.log(`→ HTTP ${res.status} ${res.statusText}`)
    console.log('→ corpo (prévia):', preview(text))
    return { res, text }
  } catch (e) {
    console.error('→ ERRO:', e instanceof Error ? e.message : e)
    return null
  }
}

async function main() {
  if (!merchantId || !clientId || !clientSecret) {
    console.error('Defina no .env: IFOOD_MERCHANT_ID, IFOOD_CLIENT_ID, IFOOD_CLIENT_SECRET')
    process.exit(1)
  }

  console.log('\n[iFood portal smoke] API base:', API)
  console.log('[iFood portal smoke] merchantId:', merchantId)
  console.log('[iFood portal smoke] Não imprimimos client_secret nem accessToken completo.\n')

  const token = await getToken()
  console.log('[auth OK] accessToken obtido (prefixo):', token.slice(0, 12) + '…')

  await runStep(
    '1) Consulta detalhes da loja',
    curlModel('GET', `/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}`),
    () => api(token, 'GET', `/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}`)
  )

  await runStep(
    '2) Consulta horários (opening-hours)',
    curlModel('GET', `/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}/opening-hours`),
    () =>
      api(token, 'GET', `/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}/opening-hours`)
  )

  await runStep(
    '3) Listagem de interrupções',
    curlModel('GET', `/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}/interruptions`),
    () =>
      api(token, 'GET', `/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}/interruptions`)
  )

  const pollPath = `/events/v1.0/events:polling?categories=${encodeURIComponent(categories)}`
  const poll = await runStep(
    '4) Aceitar eventos (polling)',
    curlModel('GET', pollPath),
    () => api(token, 'GET', pollPath)
  )

  let eventIds = []
  if (poll?.res?.ok && poll.text) {
    try {
      const arr = JSON.parse(poll.text)
      if (Array.isArray(arr)) {
        eventIds = arr
          .map((e) => (e && typeof e === 'object' && typeof e.id === 'string' ? e.id : null))
          .filter(Boolean)
      }
    } catch {
      /* ignore */
    }
  }

  if (eventIds.length > 0) {
    const body = JSON.stringify(eventIds.map((id) => ({ id })))
    await runStep(
      '5) Reconhecer evento(s) (acknowledgment)',
      `${curlModel('POST', '/events/v1.0/events/acknowledgment', "-H 'Content-Type: application/json'")} -d '${body}'`,
      () =>
        api(token, 'POST', '/events/v1.0/events/acknowledgment', {
          headers: { 'Content-Type': 'application/json' },
          body,
        })
    )
  } else {
    console.log(
      `\n(5) Sem eventos na fila — polling devolveu vazio ou 204. ACK não chamado. ` +
        `Isto é normal; o portal ainda pode contar o GET de polling como “aceitar eventos”.`
    )
  }

  await runStep(
    '6) Listagem de catálogos (catalog v2)',
    curlModel(
      'GET',
      `/catalog/v2.0/merchants/${encodeURIComponent(merchantId)}/catalogs`
    ),
    () =>
      api(
        token,
        'GET',
        `/catalog/v2.0/merchants/${encodeURIComponent(merchantId)}/catalogs`
      )
  )

  if (smokeOrderId) {
    const op = `/order/v1.0/orders/${encodeURIComponent(smokeOrderId)}`
    await runStep(
      '7a) Consulta detalhes do pedido',
      curlModel('GET', op),
      () => api(token, 'GET', op)
    )
    const cr = `/order/v1.0/orders/${encodeURIComponent(smokeOrderId)}/cancellationReasons`
    await runStep(
      '7b) Códigos de cancelamento do pedido',
      curlModel('GET', cr),
      () => api(token, 'GET', cr)
    )
  } else {
    console.log(
      '\n(7) Pulado: defina IFOOD_SMOKE_IFOOD_ORDER_ID=<uuid> para testar GET pedido + cancellationReasons.'
    )
  }

  console.log(
    '\n---\nFeito. Para RTP/dispatch/confirm/preparo/cancelamento é preciso um pedido iFood válido ' +
      'e idempotency-key — use Postman ou o fluxo real do outbox.\n'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
