import { getIfoodEnv } from './env'
import { logIntegration } from './logging'
import type {
  IfoodDeliveryAvailability,
  IfoodOrderCreatePayload,
  IfoodOrderStatus,
  IfoodShippingOrderPayload,
} from './types'

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

export async function merchantApiRequest(path: string, init: RequestInit): Promise<Response> {
  const env = getIfoodEnv()
  const token = await getAccessToken()
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init.headers as Record<string, string>),
  }
  if (init.body !== undefined && init.body !== null) {
    baseHeaders['Content-Type'] = baseHeaders['Content-Type'] ?? 'application/json'
  }
  return fetchWithRetry(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: baseHeaders,
  })
}

function okOrAccepted(response: Response): boolean {
  return response.ok || response.status === 202
}

async function ifoodRequest(path: string, init: RequestInit): Promise<Response> {
  return merchantApiRequest(path, init)
}

export async function createIfoodOrder(payload: IfoodOrderCreatePayload, idempotencyKey: string) {
  const response = await ifoodRequest('/order/v1.0/orders', {
    method: 'POST',
    headers: {
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  })

  if (!okOrAccepted(response)) {
    const body = await response.text()
    throw new Error(`Falha ao criar pedido iFood: ${response.status} ${body}`)
  }

  const text = await response.text()
  let data = {} as { id?: string; orderId?: string }
  if (text?.trim()) {
    try {
      data = JSON.parse(text) as { id?: string; orderId?: string }
    } catch {
      throw new Error('Resposta de criacao de pedido iFood com JSON invalido')
    }
  }
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

  if (!okOrAccepted(response)) {
    const body = await response.text()
    throw new Error(`Falha ao atualizar status no iFood: ${response.status} ${body}`)
  }

  logIntegration('info', 'Status atualizado no iFood', {
    ifoodOrderId: params.ifoodOrderId,
    status: params.status,
  })
}

export async function requestIfoodDelivery(params: {
  merchantId: string
  externalOrderId: string
  orderPayload: IfoodShippingOrderPayload
  idempotencyKey: string
}) {
  const env = getIfoodEnv()
  if (!env.shippingEnabled) {
    return { skipped: true as const }
  }

  const shippingPath = env.shippingOrderPath.includes('{merchantId}')
    ? env.shippingOrderPath.replace('{merchantId}', encodeURIComponent(params.merchantId))
    : `/shipping/v1.0/merchants/${encodeURIComponent(params.merchantId)}/orders`

  const orderResponse = await ifoodRequest(shippingPath, {
    method: 'POST',
    headers: {
      'x-idempotency-key': `${params.idempotencyKey}:delivery`,
    },
    body: JSON.stringify(params.orderPayload),
  })

  if (!okOrAccepted(orderResponse)) {
    const body = await orderResponse.text()
    throw new Error(`Falha ao solicitar entregador iFood: ${orderResponse.status} ${body}`)
  }

  const orderData = (await orderResponse.json()) as {
    deliveryId?: string
    orderId?: string
    id?: string
    status?: string
    trackingUrl?: string
  }
  const shippingOrderId =
    typeof orderData.orderId === 'string' && orderData.orderId.trim().length > 0
      ? orderData.orderId.trim()
      : undefined
  const deliveryId =
    typeof orderData.deliveryId === 'string' && orderData.deliveryId.trim().length > 0
      ? orderData.deliveryId.trim()
      : shippingOrderId ?? (typeof orderData.id === 'string' ? orderData.id : undefined)
  if (!deliveryId) {
    throw new Error('Resposta da solicitacao de entrega iFood sem deliveryId')
  }

  logIntegration('info', 'Entregador iFood solicitado', {
    externalOrderId: params.externalOrderId,
    deliveryId,
    shippingOrderId,
  })

  return {
    skipped: false as const,
    quoteId: params.orderPayload.delivery.quoteId,
    deliveryId,
    shippingOrderId,
    status: orderData.status ?? 'REQUESTED',
    trackingUrl: orderData.trackingUrl,
  }
}

function replacePathParam(path: string, paramName: string, value: string): string {
  return path.includes(`{${paramName}}`)
    ? path.replace(`{${paramName}}`, encodeURIComponent(value))
    : path
}

function parseAvailabilities(raw: unknown): IfoodDeliveryAvailability[] {
  if (Array.isArray(raw)) return raw as IfoodDeliveryAvailability[]
  if (raw && typeof raw === 'object') {
    const payload = raw as Record<string, unknown>
    if (Array.isArray(payload.deliveryAvailabilities)) {
      return payload.deliveryAvailabilities as IfoodDeliveryAvailability[]
    }
    if (Array.isArray(payload.items)) {
      return payload.items as IfoodDeliveryAvailability[]
    }
    if (typeof payload.id === 'string' && payload.id.trim().length > 0) {
      return [payload as unknown as IfoodDeliveryAvailability]
    }
  }
  return []
}

export async function getIfoodDeliveryAvailabilities(params: {
  merchantId: string
  latitude: number
  longitude: number
}): Promise<IfoodDeliveryAvailability[]> {
  const env = getIfoodEnv()
  const basePath = replacePathParam(env.shippingAvailabilityPath, 'merchantId', params.merchantId)
  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
  })
  const response = await ifoodRequest(`${basePath}?${query.toString()}`, {
    method: 'GET',
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao consultar disponibilidade de entrega iFood: ${response.status} ${body}`)
  }
  const data = await response.json()
  return parseAvailabilities(data)
}

export async function getIfoodDeliveryArea(params: {
  merchantId: string
}): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  const candidatePaths = [
    env.shippingDeliveryAreaPath,
    '/shipping/v1.0/merchants/{merchantId}/delivery-area',
    '/shipping/v1.0/merchants/{merchantId}/coverage-area',
    '/shipping/v1.0/coverage-area/merchants/{merchantId}',
  ].map((path) => replacePathParam(path, 'merchantId', params.merchantId))

  let lastError: string | null = null

  for (const path of candidatePaths) {
    const response = await ifoodRequest(path, {
      method: 'GET',
    })

    if (response.status === 404) {
      const body = await response.text()
      lastError = `${path} -> 404 ${body}`
      continue
    }

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Falha ao consultar area de entrega iFood: ${response.status} ${body}`)
    }

    const data = (await response.json()) as unknown
    if (!data || typeof data !== 'object') {
      return {}
    }
    return data as Record<string, unknown>
  }

  throw new Error(
    `Nao foi possivel localizar endpoint de area de entrega no iFood (rotas testadas: ${candidatePaths.join(', ')}). Ultimo erro: ${lastError ?? '404 sem detalhes'}`
  )
}

export async function getIfoodMerchantDetails(params: {
  merchantId: string
}): Promise<Record<string, unknown>> {
  const response = await ifoodRequest(`/merchant/v1.0/merchants/${encodeURIComponent(params.merchantId)}`, {
    method: 'GET',
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao consultar dados da loja no iFood: ${response.status} ${body}`)
  }

  const data = (await response.json()) as unknown
  if (!data || typeof data !== 'object') {
    return {}
  }
  return data as Record<string, unknown>
}

export async function getIfoodOrderDetails(ifoodOrderId: string): Promise<unknown> {
  const response = await ifoodRequest(
    `/order/v1.0/orders/${encodeURIComponent(ifoodOrderId)}`,
    { method: 'GET' }
  )
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao consultar pedido no iFood: ${response.status} ${body}`)
  }
  return response.json() as Promise<unknown>
}

async function postOrderSubresource(params: {
  ifoodOrderId: string
  pathSuffix: string
  idempotencyKey: string
  body?: unknown
}): Promise<void> {
  const response = await ifoodRequest(
    `/order/v1.0/orders/${encodeURIComponent(params.ifoodOrderId)}/${params.pathSuffix}`,
    {
      method: 'POST',
      headers: {
        'x-idempotency-key': params.idempotencyKey,
      },
      body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
    }
  )
  if (!okOrAccepted(response)) {
    const text = await response.text()
    throw new Error(`Falha Order API iFood (${params.pathSuffix}): ${response.status} ${text}`)
  }
}

export async function confirmIfoodOrder(params: {
  ifoodOrderId: string
  idempotencyKey: string
}) {
  await postOrderSubresource({
    ifoodOrderId: params.ifoodOrderId,
    pathSuffix: 'confirm',
    idempotencyKey: params.idempotencyKey,
  })
  logIntegration('info', 'Pedido confirmado no iFood', { ifoodOrderId: params.ifoodOrderId })
}

export async function startPreparationIfoodOrder(params: {
  ifoodOrderId: string
  idempotencyKey: string
}) {
  await postOrderSubresource({
    ifoodOrderId: params.ifoodOrderId,
    pathSuffix: 'startPreparation',
    idempotencyKey: params.idempotencyKey,
  })
  logIntegration('info', 'Preparo iniciado no iFood', { ifoodOrderId: params.ifoodOrderId })
}

export async function readyToPickupIfoodOrder(params: {
  ifoodOrderId: string
  idempotencyKey: string
}) {
  await postOrderSubresource({
    ifoodOrderId: params.ifoodOrderId,
    pathSuffix: 'readyToPickup',
    idempotencyKey: params.idempotencyKey,
  })
  logIntegration('info', 'Pronto para retirada no iFood', { ifoodOrderId: params.ifoodOrderId })
}

export async function dispatchIfoodOrder(params: {
  ifoodOrderId: string
  idempotencyKey: string
}) {
  await postOrderSubresource({
    ifoodOrderId: params.ifoodOrderId,
    pathSuffix: 'dispatch',
    idempotencyKey: params.idempotencyKey,
  })
  logIntegration('info', 'Despacho (saida para entrega) no iFood', { ifoodOrderId: params.ifoodOrderId })
}

export type IfoodCancellationReasonEntry = {
  cancelCodeId: string
  description?: string
}

export async function getIfoodCancellationReasons(
  ifoodOrderId: string
): Promise<IfoodCancellationReasonEntry[]> {
  const response = await ifoodRequest(
    `/order/v1.0/orders/${encodeURIComponent(ifoodOrderId)}/cancellationReasons`,
    { method: 'GET' }
  )
  if (response.status === 204) {
    return []
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao listar motivos de cancelamento iFood: ${response.status} ${body}`)
  }
  const data = (await response.json()) as unknown
  if (!Array.isArray(data)) return []
  return data.map((row) => {
    const r = row as Record<string, unknown>
    const cancelCodeId = typeof r.cancelCodeId === 'string' ? r.cancelCodeId : ''
    const description = typeof r.description === 'string' ? r.description : undefined
    return { cancelCodeId, description }
  }).filter((x) => x.cancelCodeId.length > 0)
}

export async function requestIfoodOrderCancellation(params: {
  ifoodOrderId: string
  cancellationCode: string
  reason: string
  idempotencyKey: string
}) {
  await postOrderSubresource({
    ifoodOrderId: params.ifoodOrderId,
    pathSuffix: 'requestCancellation',
    idempotencyKey: params.idempotencyKey,
    body: {
      cancellationCode: params.cancellationCode,
      reason: params.reason,
    },
  })
  logIntegration('info', 'Cancelamento solicitado no iFood', { ifoodOrderId: params.ifoodOrderId })
}

export async function pollOrderEvents(params?: {
  categories?: string
}): Promise<unknown[]> {
  const query = new URLSearchParams()
  if (params?.categories?.trim()) {
    query.set('categories', params.categories.trim())
  }
  const suffix = query.toString()
  const path = `/events/v1.0/events:polling${suffix ? `?${suffix}` : ''}`
  const response = await merchantApiRequest(path, { method: 'GET' })
  if (response.status === 204) {
    return []
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha no polling de eventos iFood: ${response.status} ${body}`)
  }
  const data = (await response.json()) as unknown
  return Array.isArray(data) ? data : []
}

export async function acknowledgeOrderEvents(
  events: Array<{ id: string }>
): Promise<void> {
  if (events.length === 0) return
  const response = await merchantApiRequest(`/events/v1.0/events/acknowledgment`, {
    method: 'POST',
    body: JSON.stringify(events.map((e) => ({ id: e.id }))),
  })
  if (!okOrAccepted(response)) {
    const body = await response.text()
    throw new Error(`Falha ao reconhecer eventos iFood: ${response.status} ${body}`)
  }
}

export async function getShippingOrderTracking(ifoodOrderId: string): Promise<unknown | null> {
  const response = await ifoodRequest(
    `/shipping/v1.0/orders/${encodeURIComponent(ifoodOrderId)}/tracking`,
    { method: 'GET' }
  )
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao consultar tracking Shipping iFood: ${response.status} ${body}`)
  }
  return response.json() as Promise<unknown>
}

export async function publishIfoodDeliveryArea(params: {
  merchantId: string
  city: string
  state: string
  latitude: number
  longitude: number
  radiusKm: number
  allowedNeighborhoods?: string[]
}): Promise<{
  path: string
  method: 'PUT' | 'POST' | 'PATCH'
  payload: Record<string, unknown>
  response: Record<string, unknown>
}> {
  const env = getIfoodEnv()
  const basePaths = Array.from(
    new Set(
      [
        env.shippingDeliveryAreaPath,
        '/shipping/v1.0/merchants/{merchantId}/delivery-area',
        '/shipping/v1.0/merchants/{merchantId}/deliveryArea',
        '/shipping/v1.0/merchants/{merchantId}/coverage-area',
        '/shipping/v1.0/coverage-area/merchants/{merchantId}',
      ].map((path) => replacePathParam(path, 'merchantId', params.merchantId))
    )
  )

  const methods: Array<'PUT' | 'POST' | 'PATCH'> = ['PUT', 'POST', 'PATCH']
  const payloadCandidates: Record<string, unknown>[] = [
    {
      city: params.city,
      state: params.state,
      center: {
        latitude: params.latitude,
        longitude: params.longitude,
      },
      radiusKm: params.radiusKm,
      neighborhoods: params.allowedNeighborhoods ?? [],
    },
    {
      city: params.city,
      state: params.state,
      latitude: params.latitude,
      longitude: params.longitude,
      maxDistanceKm: params.radiusKm,
      allowedNeighborhoods: params.allowedNeighborhoods ?? [],
    },
    {
      deliveryArea: {
        city: params.city,
        state: params.state,
        center: {
          lat: params.latitude,
          lng: params.longitude,
        },
        radius: params.radiusKm,
      },
      neighborhoods: params.allowedNeighborhoods ?? [],
    },
  ]

  const attempts: Array<{
    method: 'PUT' | 'POST' | 'PATCH'
    path: string
    status: number
    body: string
  }> = []

  for (const path of basePaths) {
    for (const method of methods) {
      for (const payload of payloadCandidates) {
        const response = await ifoodRequest(path, {
          method,
          body: JSON.stringify(payload),
        })

        const text = await response.text()
        attempts.push({
          method,
          path,
          status: response.status,
          body: text,
        })

        if (response.status === 404 || response.status === 405) {
          continue
        }

        if (!response.ok) {
          throw new Error(
            `Falha ao publicar area de entrega no iFood: ${response.status} ${text} | tentativa: ${method} ${path}`
          )
        }

        let parsed: Record<string, unknown> = {}
        try {
          parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
        } catch {
          parsed = { raw: text }
        }

        return {
          path,
          method,
          payload,
          response: parsed,
        }
      }
    }
  }

  const notFoundLike = attempts.filter((attempt) => attempt.status === 404 || attempt.status === 405)
  if (attempts.length > 0 && notFoundLike.length === attempts.length) {
    const routes = Array.from(new Set(attempts.map((attempt) => attempt.path))).join(', ')
    throw new Error(
      `Conta iFood sem endpoint de publicacao de area de entrega habilitado para este merchant. Rotas testadas: ${routes}.`
    )
  }

  const firstNonNotFound = attempts.find((attempt) => attempt.status !== 404 && attempt.status !== 405)
  if (firstNonNotFound) {
    throw new Error(
      `Falha ao publicar area de entrega no iFood: ${firstNonNotFound.status} ${firstNonNotFound.body} | tentativa: ${firstNonNotFound.method} ${firstNonNotFound.path}`
    )
  }

  throw new Error(
    'Nao foi possivel publicar area de entrega no iFood.'
  )
}
