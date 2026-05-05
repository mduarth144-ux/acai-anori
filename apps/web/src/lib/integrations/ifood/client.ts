import { getIfoodEnv } from './env'
import { logIntegration } from './logging'
import type {
  IfoodCancellationAction,
  IfoodCancellationPayload,
  IfoodCatalogCategory,
  IfoodCatalogComplement,
  IfoodCatalogItem,
  IfoodCatalogProduct,
  IfoodOrderDetails,
  IfoodOrderCreatePayload,
  IfoodOrderStatus,
  IfoodShippingOrderPayload,
  IfoodStoreInterruption,
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

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  if (!text) return null
  return JSON.parse(text) as T
}

async function ifoodJsonRequest<T = Record<string, unknown>>(
  path: string,
  init: RequestInit,
  errorPrefix: string
): Promise<T> {
  const response = await ifoodRequest(path, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${errorPrefix}: ${response.status} ${body}`)
  }
  const parsed = await parseJsonSafe<T>(response)
  return (parsed ?? ({} as T)) as T
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

function replacePathParam(path: string, paramName: string, value: string): string {
  return path.includes(`{${paramName}}`) ? path.replace(`{${paramName}}`, encodeURIComponent(value)) : path
}

export async function getIfoodOrderDetails(ifoodOrderId: string): Promise<IfoodOrderDetails> {
  const env = getIfoodEnv()
  const path = replacePathParam(env.orderDetailsPath, 'orderId', ifoodOrderId)
  return ifoodJsonRequest<IfoodOrderDetails>(path, { method: 'GET' }, 'Falha ao consultar detalhes do pedido iFood')
}

export async function acknowledgeIfoodEvent(eventId: string): Promise<void> {
  const env = getIfoodEnv()
  const path = replacePathParam(env.eventsAckPath, 'eventId', eventId)
  const response = await ifoodRequest(path, { method: 'POST', body: JSON.stringify({}) })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao reconhecer evento iFood: ${response.status} ${body}`)
  }
}

export async function notifyOrderReadyForPickup(ifoodOrderId: string, idempotencyKey: string): Promise<void> {
  const env = getIfoodEnv()
  const path = replacePathParam(env.orderReadyPath, 'orderId', ifoodOrderId)
  const response = await ifoodRequest(path, {
    method: 'POST',
    headers: {
      'x-idempotency-key': `${idempotencyKey}:ready`,
    },
    body: JSON.stringify({}),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao notificar pedido pronto para retirada: ${response.status} ${body}`)
  }
}

export async function notifyOrderOutForDelivery(
  ifoodOrderId: string,
  idempotencyKey: string
): Promise<void> {
  const env = getIfoodEnv()
  const path = replacePathParam(env.orderDispatchPath, 'orderId', ifoodOrderId)
  const response = await ifoodRequest(path, {
    method: 'POST',
    headers: {
      'x-idempotency-key': `${idempotencyKey}:dispatch`,
    },
    body: JSON.stringify({}),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao notificar saida para entrega: ${response.status} ${body}`)
  }
}

async function cancellationActionPath(orderId: string, action: IfoodCancellationAction): Promise<string> {
  const env = getIfoodEnv()
  const base = replacePathParam(env.cancelBasePath, 'orderId', orderId)
  const suffix: Record<IfoodCancellationAction, string> = {
    REQUEST: '/request',
    ACCEPT_REQUEST: '/request/accept',
    REJECT_REQUEST: '/request/reject',
    ACCEPT_AGREEMENT: '/agreement/accept',
    REJECT_AGREEMENT: '/agreement/reject',
    PROPOSAL: '/proposal',
  }
  return `${base}${suffix[action]}`
}

export async function listCancellationReasons(orderId: string): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  const base = replacePathParam(env.cancelBasePath, 'orderId', orderId)
  return ifoodJsonRequest<Record<string, unknown>>(
    `${base}/reasons`,
    { method: 'GET' },
    'Falha ao consultar codigos de cancelamento'
  )
}

export async function performCancellationAction(
  action: IfoodCancellationAction,
  payload: IfoodCancellationPayload,
  idempotencyKey: string
): Promise<Record<string, unknown>> {
  const path = await cancellationActionPath(payload.orderId, action)
  return ifoodJsonRequest<Record<string, unknown>>(
    path,
    {
      method: 'POST',
      headers: { 'x-idempotency-key': `${idempotencyKey}:cancel:${action.toLowerCase()}` },
      body: JSON.stringify(payload),
    },
    `Falha ao executar acao de cancelamento (${action})`
  )
}

export async function listCatalogs(): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/merchants/${encodeURIComponent(env.merchantId)}/catalogs`,
    { method: 'GET' },
    'Falha ao listar catalogos iFood'
  )
}

export async function listCategories(catalogId: string): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/catalogs/${encodeURIComponent(catalogId)}/categories`,
    { method: 'GET' },
    'Falha ao listar categorias iFood'
  )
}

export async function listProducts(catalogId: string): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/catalogs/${encodeURIComponent(catalogId)}/products`,
    { method: 'GET' },
    'Falha ao listar produtos iFood'
  )
}

export async function createOrUpdateCategory(
  catalogId: string,
  category: IfoodCatalogCategory
): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/catalogs/${encodeURIComponent(catalogId)}/categories`,
    { method: 'POST', body: JSON.stringify(category) },
    'Falha ao criar/atualizar categoria iFood'
  )
}

export async function createOrUpdateProduct(
  catalogId: string,
  product: IfoodCatalogProduct
): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/catalogs/${encodeURIComponent(catalogId)}/products`,
    { method: 'POST', body: JSON.stringify(product) },
    'Falha ao criar/atualizar produto iFood'
  )
}

export async function createOrUpdateItem(item: IfoodCatalogItem): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/items`,
    { method: 'POST', body: JSON.stringify(item) },
    'Falha ao criar/atualizar item iFood'
  )
}

export async function createOrUpdateComplement(
  complement: IfoodCatalogComplement
): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/complements`,
    { method: 'POST', body: JSON.stringify(complement) },
    'Falha ao criar/atualizar complemento iFood'
  )
}

export async function deleteCatalogEntity(
  entity: 'categories' | 'products' | 'items' | 'complements',
  id: string
): Promise<void> {
  const env = getIfoodEnv()
  const response = await ifoodRequest(`${env.catalogBasePath}/${entity}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao remover entidade de catalogo (${entity}): ${response.status} ${body}`)
  }
}

export async function batchUpdateProductPrices(
  updates: Array<{ externalCode: string; price: number }>
): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/products/batch/price`,
    { method: 'PATCH', body: JSON.stringify({ updates }) },
    'Falha ao atualizar precos em lote'
  )
}

export async function batchUpdateProductsByExternalCode(
  updates: Array<Record<string, unknown>>
): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/products/batch/external-code`,
    { method: 'PATCH', body: JSON.stringify({ updates }) },
    'Falha ao atualizar produtos por external code em lote'
  )
}

export async function uploadCatalogImage(params: {
  fileName: string
  mimeType: string
  contentBase64: string
}): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/images/upload`,
    { method: 'POST', body: JSON.stringify(params) },
    'Falha ao fazer upload de imagem no iFood'
  )
}

export async function updateCatalogEntityStatus(params: {
  entity: 'products' | 'items'
  id: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
}): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/${params.entity}/${encodeURIComponent(params.id)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: params.status }) },
    'Falha ao atualizar status de entidade de catalogo'
  )
}

export async function listRestrictedItems(): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.catalogBasePath}/items/restrictions`,
    { method: 'GET' },
    'Falha ao listar itens com restricao de venda'
  )
}

export async function getStoreDetails(): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.merchantBasePath}/merchants/${encodeURIComponent(env.merchantId)}`,
    { method: 'GET' },
    'Falha ao consultar detalhes da loja'
  )
}

export async function getStoreOperatingHours(): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.merchantBasePath}/merchants/${encodeURIComponent(env.merchantId)}/operating-hours`,
    { method: 'GET' },
    'Falha ao consultar horarios de funcionamento'
  )
}

export async function updateStoreOperatingHours(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.merchantBasePath}/merchants/${encodeURIComponent(env.merchantId)}/operating-hours`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Falha ao atualizar horarios de funcionamento'
  )
}

export async function listStoreInterruptions(): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.merchantBasePath}/merchants/${encodeURIComponent(env.merchantId)}/interruptions`,
    { method: 'GET' },
    'Falha ao listar interrupcoes da loja'
  )
}

export async function createStoreInterruption(
  payload: IfoodStoreInterruption
): Promise<Record<string, unknown>> {
  const env = getIfoodEnv()
  return ifoodJsonRequest<Record<string, unknown>>(
    `${env.merchantBasePath}/merchants/${encodeURIComponent(env.merchantId)}/interruptions`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Falha ao criar interrupcao da loja'
  )
}

export async function deleteStoreInterruption(interruptionId: string): Promise<void> {
  const env = getIfoodEnv()
  const response = await ifoodRequest(
    `${env.merchantBasePath}/merchants/${encodeURIComponent(env.merchantId)}/interruptions/${encodeURIComponent(interruptionId)}`,
    { method: 'DELETE' }
  )
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao remover interrupcao da loja: ${response.status} ${body}`)
  }
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

  if (!orderResponse.ok) {
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
  const deliveryId = orderData.deliveryId ?? orderData.orderId ?? orderData.id
  if (!deliveryId) {
    throw new Error('Resposta da solicitacao de entrega iFood sem deliveryId')
  }

  logIntegration('info', 'Entregador iFood solicitado', {
    externalOrderId: params.externalOrderId,
    deliveryId,
  })

  return {
    skipped: false as const,
    quoteId: undefined,
    deliveryId,
    status: orderData.status ?? 'REQUESTED',
    trackingUrl: orderData.trackingUrl,
  }
}
