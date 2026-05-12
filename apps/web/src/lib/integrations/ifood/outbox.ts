/**
 * Fila assíncrona: criar pedido no iFood (Order API e/ou Shipping API) e, em entrega com endereço,
 * solicitar logística quando aplicável. Por defeito, entrega com endereço usa primeiro a Shipping API
 * (`IFOOD_PRIMARY_ORDER_CREATE`, ver `integration-flags.ts`) para evitar 404 quando a Order API não
 * está exposta ao OAuth da aplicação.
 */
import {
  IntegrationOutboxSource,
  IntegrationOutboxStatus,
  IntegrationOutboxTopic,
  Prisma,
} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../prisma'
import {
  createIfoodOrder,
  getIfoodDeliveryAvailabilities,
  getIfoodMerchantDetails,
  requestIfoodDelivery,
} from './client'
import { buildIfoodOrderCreatePayload } from './order-create-payload'
import { syncLocalStatusToIfoodApi } from './order-status-sync'
import { logIntegration } from './logging'
import { getIfoodRefs, mergeIfoodRefs } from './ifood-response'
import { getIfoodDeliveryAreaConfig } from './delivery-area-config'
import { getIfoodPrimaryOrderCreateStrategy } from './integration-flags'
import type { IfoodShippingOrderPayload } from './types'

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { product: true } } }
}>

type IntegrationOutboxDelegate = {
  create: (...args: any[]) => Promise<any>
  update: (...args: any[]) => Promise<any>
  findMany: (...args: any[]) => Promise<any[]>
  updateMany: (...args: any[]) => Promise<{ count: number }>
}

function getIntegrationOutboxDelegate(): IntegrationOutboxDelegate | null {
  const delegate = (prisma as unknown as { integrationOutbox?: IntegrationOutboxDelegate })
    .integrationOutbox
  return delegate ?? null
}

function nextAttemptDate(attempts: number): Date {
  const seconds = Math.min(300, 5 * 2 ** Math.max(0, attempts))
  return new Date(Date.now() + seconds * 1000)
}

function extractIfoodErrorCode(message: string): string | null {
  const match = message.match(/"code"\s*:\s*"([^"]+)"/)
  return match?.[1] ?? null
}

function getNonRetryableIfoodError(message: string): string | null {
  const code = extractIfoodErrorCode(message)
  if (code === 'DeliveryDistanceTooHigh') {
    return 'Endereco fora da area de cobertura do iFood para entrega.'
  }
  if (code === 'UnavailableFleet' || code === 'NRELimitExceeded') {
    return 'No momento nao ha entregadores disponiveis na sua regiao. Tente novamente em instantes.'
  }
  if (code === 'MerchantStatusAvailability') {
    return 'A loja esta temporariamente indisponivel para entregas no iFood.'
  }
  if (message.includes('deliveryAvailabilities vazio')) {
    return 'No momento nao ha entregadores disponiveis na sua regiao. Tente novamente em instantes.'
  }
  return null
}

function ensureNumber(value: Prisma.Decimal | number): number {
  if (typeof value === 'number') return value
  return Number(value)
}

function parseCustomerPhone(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '')
  const normalized = digits.length >= 11 ? digits.slice(-11) : '92999999999'
  return {
    countryCode: '55',
    areaCode: normalized.slice(0, 2),
    number: normalized.slice(2),
    type: 'CUSTOMER' as const,
  }
}

async function geocodeDeliveryAddress(params: {
  postalCode: string
  streetName: string
  streetNumber: string
  neighborhood: string
  city: string
  state: string
}): Promise<{ latitude: number; longitude: number } | null> {
  const query = [
    params.streetName,
    params.streetNumber,
    params.neighborhood,
    params.city,
    params.state,
    params.postalCode,
    'Brasil',
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ')

  if (!query) return null

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('q', query)

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'CardapioDigital/1.0 (cardapio-digital; ifood-shipping-geocode)',
      },
      next: { revalidate: 0 },
    })
    if (!response.ok) return null

    const data = (await response.json()) as Array<{ lat?: string; lon?: string }>
    const first = data[0]
    const latitude = Number(first?.lat)
    const longitude = Number(first?.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return { latitude, longitude }
  } catch {
    return null
  }
}

async function parseDeliveryAddress(
  address: string | null | undefined,
  config: {
    city: string
    state: string
    defaultLatitude: number
    defaultLongitude: number
  }
) {
  const lines = (address ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const postalCode = (lines[0]?.match(/\d{5}-?\d{3}/)?.[0] ?? '69000000').replace(/\D/g, '')
  const streetLine = lines[1] ?? 'Rua Tito Bittencourt, 83'
  const [streetNameRaw, streetNumberRaw] = streetLine.split(',').map((part) => part?.trim() ?? '')
  const streetName = streetNameRaw || 'Rua nao informada'
  const streetNumber = streetNumberRaw || 'S/N'
  const neighborhood = lines[2] || 'Centro'
  const coordinates =
    (await geocodeDeliveryAddress({
      postalCode,
      streetName,
      streetNumber,
      neighborhood,
      city: config.city,
      state: config.state,
    })) ?? {
      latitude: config.defaultLatitude,
      longitude: config.defaultLongitude,
    }

  return {
    postalCode,
    streetNumber,
    streetName,
    neighborhood,
    city: config.city,
    state: config.state,
    country: 'BR',
    coordinates,
  }
}

async function buildOrderContext() {
  const merchantId = process.env.IFOOD_MERCHANT_ID?.trim()
  if (!merchantId) {
    throw new Error('IFOOD_MERCHANT_ID nao configurado')
  }

  return {
    merchantId,
  }
}

async function getEffectiveDeliveryAreaConfig(baseConfig: {
  city: string
  state: string
  defaultLatitude: number
  defaultLongitude: number
}) {
  try {
    const context = await buildOrderContext()
    const merchant = await getIfoodMerchantDetails({ merchantId: context.merchantId })
    const address =
      merchant.address && typeof merchant.address === 'object'
        ? (merchant.address as Record<string, unknown>)
        : {}
    const city = typeof address.city === 'string' ? address.city : ''
    const state = typeof address.state === 'string' ? address.state : ''
    const latitude =
      typeof address.latitude === 'number' ? address.latitude : Number(address.latitude)
    const longitude =
      typeof address.longitude === 'number' ? address.longitude : Number(address.longitude)
    if (city && state && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        ...baseConfig,
        city,
        state,
        defaultLatitude: latitude,
        defaultLongitude: longitude,
      }
    }
  } catch {
    // keep local config when merchant endpoint is unavailable
  }
  return baseConfig
}

type DeliveryAreaConfigResolved = Awaited<ReturnType<typeof getEffectiveDeliveryAreaConfig>>

function buildShippingOrderPaymentMethods(
  order: OrderWithItems
): IfoodShippingOrderPayload['payments']['methods'] {
  const totalPrice = ensureNumber(order.total)
  const pm = order.paymentMethod
  if (pm === 'CASH') {
    return [
      {
        method: 'CASH',
        type: 'OFFLINE',
        value: totalPrice,
        cash: { changeFor: ensureNumber(order.changeFor ?? totalPrice) },
      },
    ]
  }
  if (pm === 'PIX') {
    // Shipping merchants/orders aceita apenas CASH ou cartão; PIX já foi liquidado no app.
    return [
      {
        method: 'CASH',
        type: 'OFFLINE',
        value: totalPrice,
        cash: { changeFor: totalPrice },
      },
    ]
  }
  if (pm === 'CREDIT' || pm === 'DEBIT') {
    return [
      {
        method: pm,
        type: 'OFFLINE',
        value: totalPrice,
        card: { brand: 'VISA' },
      },
    ]
  }
  return [
    {
      method: 'CREDIT',
      type: 'OFFLINE',
      value: totalPrice,
      card: { brand: 'VISA' },
    },
  ]
}

async function runIfoodShippingMerchantOrder(params: {
  order: OrderWithItems
  merchantId: string
  deliveryAreaConfig: DeliveryAreaConfigResolved
  idempotencyKey: string
}) {
  const { order, merchantId, deliveryAreaConfig, idempotencyKey } = params

  const unitPrice = ensureNumber(order.items[0]?.unitPrice ?? ensureNumber(order.total))
  const quantity = Math.max(1, order.items[0]?.quantity ?? 1)
  const price = unitPrice * quantity
  const optionsPrice = Math.max(0, ensureNumber(order.total) - price)
  const totalPrice = ensureNumber(order.total)

  const deliveryAddress = await parseDeliveryAddress(order.address, deliveryAreaConfig)
  let availabilities = await getIfoodDeliveryAvailabilities({
    merchantId,
    latitude: deliveryAddress.coordinates.latitude,
    longitude: deliveryAddress.coordinates.longitude,
  }).catch(async (error) => {
    const message =
      error instanceof Error ? error.message : 'Falha ao consultar disponibilidade de entrega iFood'
    const shouldFallback = message.includes('DeliveryDistanceTooHigh')
    if (!shouldFallback) {
      throw error
    }

    logIntegration('warn', 'Endereco fora da area no iFood; tentando fallback com ponto padrao', {
      orderId: order.id,
      latitude: deliveryAddress.coordinates.latitude,
      longitude: deliveryAddress.coordinates.longitude,
      fallbackLatitude: deliveryAreaConfig.defaultLatitude,
      fallbackLongitude: deliveryAreaConfig.defaultLongitude,
    })

    return getIfoodDeliveryAvailabilities({
      merchantId,
      latitude: deliveryAreaConfig.defaultLatitude,
      longitude: deliveryAreaConfig.defaultLongitude,
    })
  })
  const availability = availabilities[0]
  if (!availability?.id) {
    throw new Error('iFood sem disponibilidade para coordenadas informadas (deliveryAvailabilities vazio)')
  }

  const shipping = await requestIfoodDelivery({
    idempotencyKey,
    merchantId,
    externalOrderId: order.id,
    orderPayload: {
      customer: {
        name: order.customerName?.trim() || 'Cliente',
        phone: parseCustomerPhone(order.customerPhone),
      },
      delivery: {
        merchantFee: 0,
        quoteId: availability.id,
        deliveryAddress,
      },
      items: [
        {
          id: randomUUID(),
          name: order.items[0]?.product?.name || 'Pedido',
          quantity,
          unitPrice,
          price,
          optionsPrice,
          totalPrice,
        },
      ],
      payments: {
        methods: buildShippingOrderPaymentMethods(order),
      },
    },
  })

  if (shipping.skipped) {
    throw new Error(
      'Shipping iFood desabilitado (IFOOD_SHIPPING_ENABLED=false); nao e possivel criar pedido apenas pela Shipping API'
    )
  }

  const ifoodOrderId = (shipping.shippingOrderId ?? shipping.deliveryId).trim()
  if (!ifoodOrderId) {
    throw new Error('Resposta Shipping iFood sem id de pedido utilizavel')
  }

  return {
    ifoodOrderId,
    quoteId: shipping.quoteId,
    deliveryId: shipping.deliveryId,
    shippingOrderId: shipping.shippingOrderId,
    status: shipping.status,
    shippingApiResponse: shipping.shippingApiResponse,
  }
}

export async function enqueueOrderCreate(orderId: string) {
  const outbox = getIntegrationOutboxDelegate()
  if (!outbox) {
    logIntegration('warn', 'integrationOutbox indisponivel; pulando enqueue de criacao', { orderId })
    return
  }

  await outbox.create({
    data: {
      orderId,
      topic: IntegrationOutboxTopic.IFOOD_ORDER_CREATE,
      source: IntegrationOutboxSource.INTERNAL,
      idempotencyKey: `ifood:create:${orderId}`,
      payload: {},
    },
  })
}

export async function enqueueStatusUpdate(params: {
  orderId: string
  status: string
  source: 'INTERNAL' | 'IFOOD_WEBHOOK'
}) {
  if (params.source === 'IFOOD_WEBHOOK') return

  const outbox = getIntegrationOutboxDelegate()
  if (!outbox) {
    logIntegration('warn', 'integrationOutbox indisponivel; pulando enqueue de status', {
      orderId: params.orderId,
      status: params.status,
    })
    return
  }

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { ifoodResponse: true },
  })
  const ifoodRefs = getIfoodRefs(order?.ifoodResponse)
  if (!ifoodRefs.ifoodOrderId) {
    logIntegration('info', 'Sem ifoodOrderId ainda; pulando enqueue de status até a Order API iFood devolver o id', {
      orderId: params.orderId,
      status: params.status,
    })
    return
  }

  await outbox.create({
    data: {
      orderId: params.orderId,
      topic: IntegrationOutboxTopic.IFOOD_ORDER_STATUS_UPDATE,
      source: IntegrationOutboxSource.INTERNAL,
      idempotencyKey: `ifood:status:${params.orderId}:${params.status}:${Date.now()}`,
      payload: { status: params.status },
    },
  })
}

async function markFailed(
  itemId: string,
  attempts: number,
  error: string,
  options?: { forceFailed?: boolean }
) {
  const outbox = getIntegrationOutboxDelegate()
  if (!outbox) return

  await outbox.update({
    where: { id: itemId },
    data: {
      status:
        options?.forceFailed || attempts >= 6
          ? IntegrationOutboxStatus.FAILED
          : IntegrationOutboxStatus.PENDING,
      attempts,
      lastError: error.slice(0, 1000),
      nextAttemptAt: nextAttemptDate(attempts),
      lockedAt: null,
    },
  })
}

export async function processOutboxBatch(
  limit = 20,
  options?: { prioritizeOrderId?: string }
) {
  const outbox = getIntegrationOutboxDelegate()
  if (!outbox) {
    logIntegration('warn', 'integrationOutbox indisponivel; processOutboxBatch ignorado')
    return {
      totalPending: 0,
      processed: 0,
    }
  }

  const now = new Date()
  const baseWhere = {
    status: IntegrationOutboxStatus.PENDING,
    nextAttemptAt: { lte: now },
  } as const

  let pending: Awaited<ReturnType<typeof outbox.findMany>> = []

  if (options?.prioritizeOrderId?.trim()) {
    const oid = options.prioritizeOrderId.trim()
    pending = await outbox.findMany({
      where: {
        ...baseWhere,
        orderId: oid,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
  }

  if (pending.length < limit) {
    const excludeIds = pending.map((row) => row.id)
    const rest = await outbox.findMany({
      where: {
        ...baseWhere,
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit - pending.length,
    })
    pending = [...pending, ...rest]
  }

  let processed = 0
  for (const item of pending) {
    const lock = await outbox.updateMany({
      where: {
        id: item.id,
        status: IntegrationOutboxStatus.PENDING,
      },
      data: {
        status: IntegrationOutboxStatus.PROCESSING,
        lockedAt: new Date(),
      },
    })
    if (!lock.count) continue

    try {
      const order = await prisma.order.findUnique({
        where: { id: item.orderId },
        include: { items: { include: { product: true } } },
      })
      if (!order) {
        throw new Error('Pedido nao encontrado para outbox')
      }

      if (item.topic === IntegrationOutboxTopic.IFOOD_ORDER_CREATE) {
        const context = await buildOrderContext()
        const deliveryAreaConfig = await getEffectiveDeliveryAreaConfig(
          await getIfoodDeliveryAreaConfig()
        )
        let deliveryQuoteId: string | undefined
        let deliveryId: string | undefined
        let deliveryStatus: string | undefined
        let shippingOrderId: string | undefined
        let ifoodOrderId: string | undefined
        let orderCreateApiResponse: Record<string, unknown> | undefined
        let shippingOrderApiResponse: Record<string, unknown> | undefined

        const hasDeliveryAddress = order.type === 'DELIVERY' && Boolean(order.address?.trim())
        const primary = getIfoodPrimaryOrderCreateStrategy(order.type, hasDeliveryAddress)

        if (primary === 'shipping' && hasDeliveryAddress) {
          const shippingRun = await runIfoodShippingMerchantOrder({
            order,
            merchantId: context.merchantId,
            deliveryAreaConfig,
            idempotencyKey: item.idempotencyKey,
          })
          ifoodOrderId = shippingRun.ifoodOrderId
          deliveryQuoteId = shippingRun.quoteId
          deliveryId = shippingRun.deliveryId
          deliveryStatus = shippingRun.status
          shippingOrderId = shippingRun.shippingOrderId
          shippingOrderApiResponse = shippingRun.shippingApiResponse
          orderCreateApiResponse = {
            _iFoodCreationPath: 'shipping_merchant_orders_v1',
            ...(shippingRun.shippingApiResponse ?? {}),
          }
        } else {
          const payload = buildIfoodOrderCreatePayload(order, context.merchantId)
          const created = await createIfoodOrder(payload, item.idempotencyKey)
          ifoodOrderId = created.ifoodOrderId
          orderCreateApiResponse = created.orderCreateResponse

          if (hasDeliveryAddress) {
            const shippingRun = await runIfoodShippingMerchantOrder({
              order,
              merchantId: context.merchantId,
              deliveryAreaConfig,
              idempotencyKey: item.idempotencyKey,
            })
            deliveryQuoteId = shippingRun.quoteId
            deliveryId = shippingRun.deliveryId
            deliveryStatus = shippingRun.status
            shippingOrderId = shippingRun.shippingOrderId
            shippingOrderApiResponse = shippingRun.shippingApiResponse
          }
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            ifoodResponse: mergeIfoodRefs(order.ifoodResponse, {
              ifoodOrderId,
              orderCreateApiResponse,
              ...(shippingOrderApiResponse !== undefined ? { shippingOrderApiResponse } : {}),
              shippingOrderId,
              deliveryQuoteId,
              deliveryId,
              deliveryStatus,
              syncState: 'synced',
              syncError: null,
              source: 'internal',
              lastSyncAt: new Date().toISOString(),
            }),
          },
        })
      } else if (item.topic === IntegrationOutboxTopic.IFOOD_ORDER_STATUS_UPDATE) {
        const status = (item.payload as Record<string, unknown>).status
        if (typeof status !== 'string') {
          throw new Error('Payload de status invalido')
        }
        const ifoodRefs = getIfoodRefs(order.ifoodResponse)
        const ifoodOrderIdForSync = ifoodRefs.ifoodOrderId
        if (typeof ifoodOrderIdForSync !== 'string' || !ifoodOrderIdForSync) {
          throw new Error('Pedido sem ifoodOrderId para sync de status')
        }
        const extraRefs = await syncLocalStatusToIfoodApi({
          order: {
            id: order.id,
            type: order.type,
            status: order.status,
            ifoodResponse: order.ifoodResponse,
          },
          newStatus: status as 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED',
          idempotencyKey: item.idempotencyKey,
        })
        await prisma.order.update({
          where: { id: order.id },
          data: {
            ifoodResponse: mergeIfoodRefs(order.ifoodResponse, {
              ...extraRefs,
              syncState: 'synced',
              syncError: null,
              lastStatusSyncedAt: new Date().toISOString(),
            }),
          },
        })
      }

      await outbox.update({
        where: { id: item.id },
        data: {
          status: IntegrationOutboxStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          attempts: { increment: 1 },
          lastError: null,
        },
      })
      processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido no outbox'
      const nonRetryableError = getNonRetryableIfoodError(message)
      logIntegration('error', 'Falha ao processar outbox', {
        outboxId: item.id,
        orderId: item.orderId,
        topic: item.topic,
        error: message,
      })
      await markFailed(item.id, item.attempts + 1, message, {
        forceFailed: Boolean(nonRetryableError),
      })

      if (nonRetryableError && item.topic === IntegrationOutboxTopic.IFOOD_ORDER_CREATE) {
        const order = await prisma.order.findUnique({
          where: { id: item.orderId },
          select: { ifoodResponse: true },
        })
        if (order) {
          await prisma.order.update({
            where: { id: item.orderId },
            data: {
              ifoodResponse: mergeIfoodRefs(order.ifoodResponse, {
                syncState: 'failed',
                syncError: nonRetryableError,
                source: 'internal',
                lastSyncAt: new Date().toISOString(),
              }),
            },
          })
        }
      }
    }
  }

  return {
    totalPending: pending.length,
    processed,
  }
}

const STUCK_PROCESSING_MS = 3 * 60_000

/**
 * Libera fila presa e reenfileira criação iFood **FAILED** para este pedido (ex.: após corrigir .env).
 * Chamado antes de `processOutboxBatch` no fluxo admin / refresh.
 */
export async function recoverIfoodIntegrationOutboxForOrder(orderId: string): Promise<{
  stuckProcessingReset: number
  failedCreateRequeued: boolean
  failedCreateLastError: string | null
}> {
  const stuck = await prisma.integrationOutbox.updateMany({
    where: {
      orderId,
      status: IntegrationOutboxStatus.PROCESSING,
      lockedAt: { lt: new Date(Date.now() - STUCK_PROCESSING_MS) },
    },
    data: {
      status: IntegrationOutboxStatus.PENDING,
      lockedAt: null,
    },
  })

  const failedCreate = await prisma.integrationOutbox.findFirst({
    where: {
      orderId,
      topic: IntegrationOutboxTopic.IFOOD_ORDER_CREATE,
      status: IntegrationOutboxStatus.FAILED,
    },
    orderBy: { updatedAt: 'desc' },
  })

  let failedCreateRequeued = false
  let failedCreateLastError: string | null = null
  if (failedCreate) {
    failedCreateLastError = failedCreate.lastError ?? null
    await prisma.integrationOutbox.update({
      where: { id: failedCreate.id },
      data: {
        status: IntegrationOutboxStatus.PENDING,
        nextAttemptAt: new Date(),
        lockedAt: null,
      },
    })
    failedCreateRequeued = true
  }

  return {
    stuckProcessingReset: stuck.count,
    failedCreateRequeued,
    failedCreateLastError,
  }
}
