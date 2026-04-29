import { getIfoodEnv } from './env'
import { logIntegration } from './logging'
import type { IfoodOrderCreatePayload, IfoodOrderStatus } from './types'

type AuthCache = {
  token: string
  expiresAt: number
}

let authCache: AuthCache | null = null

function jitterMs(attempt: number): number {
  const base = 250 * 2 ** Math.max(0, attempt - 1)
  return base + Math.floor(Math.random() * 200)
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  input: string,
  init: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) return response
      if (response.status < 500 && response.status !== 429) return response

      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }

    if (attempt < maxAttempts) {
      await sleep(jitterMs(attempt))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha em chamada HTTP')
}

async function getAccessToken(): Promise<string> {
  if (authCache && authCache.expiresAt > Date.now() + 15_000) {
    return authCache.token
  }

  const env = getIfoodEnv()
  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId: env.clientId,
    clientSecret: env.clientSecret,
  })

  const response = await fetchWithRetry(env.authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Erro ao autenticar no iFood: ${response.status} ${text}`)
  }

  const data = (await response.json()) as { accessToken?: string; expiresIn?: number }
  if (!data.accessToken) {
    throw new Error('Resposta de autenticacao iFood sem accessToken')
  }

  authCache = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expiresIn ?? 300) * 1000,
  }
  return authCache.token
}

async function ifoodRequest(path: string, init: RequestInit): Promise<Response> {
  const env = getIfoodEnv()
  const token = await getAccessToken()
  return fetchWithRetry(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export async function createIfoodOrder(payload: IfoodOrderCreatePayload, idempotencyKey: string) {
  const response = await ifoodRequest('/order/v1.0/orders', {
    method: 'POST',
    headers: {
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao criar pedido iFood: ${response.status} ${body}`)
  }

  const data = (await response.json()) as { id?: string; orderId?: string }
  const ifoodOrderId = data.orderId ?? data.id
  if (!ifoodOrderId) {
    throw new Error('Resposta de criacao de pedido iFood sem orderId')
  }

  logIntegration('info', 'Pedido publicado no iFood', {
    localOrderId: payload.externalOrderId,
    ifoodOrderId,
  })
  return { ifoodOrderId }
}

export async function updateIfoodOrderStatus(params: {
  ifoodOrderId: string
  status: IfoodOrderStatus
  idempotencyKey: string
}) {
  const response = await ifoodRequest(`/order/v1.0/orders/${params.ifoodOrderId}/status`, {
    method: 'POST',
    headers: {
      'x-idempotency-key': params.idempotencyKey,
    },
    body: JSON.stringify({
      status: params.status,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao atualizar status no iFood: ${response.status} ${body}`)
  }

  logIntegration('info', 'Status atualizado no iFood', {
    ifoodOrderId: params.ifoodOrderId,
    status: params.status,
  })
}
