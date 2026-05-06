import {
  IntegrationOutboxSource,
  IntegrationOutboxStatus,
  IntegrationOutboxTopic,
  Prisma,
} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../prisma'
import { mapLocalStatusToIfood } from './status-map'
import { requestIfoodDelivery, updateIfoodOrderStatus } from './client'
import { logIntegration } from './logging'
import { getIfoodRefs, mergeIfoodRefs } from './external-refs'
import { getIfoodDeliveryAreaConfig } from './delivery-area-config'

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

function parseDeliveryAddress(
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
  return {
    postalCode,
    streetNumber: streetNumberRaw || 'S/N',
    streetName: streetNameRaw || 'Rua nao informada',
    neighborhood: lines[2] || 'Centro',
    city: config.city,
    state: config.state,
    country: 'BR',
    coordinates: {
      latitude: config.defaultLatitude,
      longitude: config.defaultLongitude,
    },
  }
}

function assertAddressWithinConfiguredArea(
  address: ReturnType<typeof parseDeliveryAddress>,
  config: {
    allowedCities: string[]
    allowedNeighborhoods: string[]
  }
) {
  if (config.allowedCities.length) {
    const city = address.city.trim().toLowerCase()
    if (!config.allowedCities.includes(city)) {
      throw new Error(
        `Endereco fora da area configurada: cidade "${address.city}" nao permitida`
      )
    }
  }
  if (config.allowedNeighborhoods.length) {
    const neighborhood = address.neighborhood.trim().toLowerCase()
    if (!config.allowedNeighborhoods.includes(neighborhood)) {
      throw new Error(
        `Endereco fora da area configurada: bairro "${address.neighborhood}" nao permitido`
      )
    }
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
    select: { externalRefs: true },
  })
  const ifoodRefs = getIfoodRefs(order?.externalRefs)
  if (!ifoodRefs.ifoodOrderId) {
    logIntegration('info', 'Pedido sem ifoodOrderId; pulando enqueue de status', {
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

async function markFailed(itemId: string, attempts: number, error: string) {
  const outbox = getIntegrationOutboxDelegate()
  if (!outbox) return

  await outbox.update({
    where: { id: itemId },
    data: {
      status: attempts >= 6 ? IntegrationOutboxStatus.FAILED : IntegrationOutboxStatus.PENDING,
      attempts,
      lastError: error.slice(0, 1000),
      nextAttemptAt: nextAttemptDate(attempts),
      lockedAt: null,
    },
  })
}

export async function processOutboxBatch(limit = 20) {
  const outbox = getIntegrationOutboxDelegate()
  if (!outbox) {
    logIntegration('warn', 'integrationOutbox indisponivel; processOutboxBatch ignorado')
    return {
      totalPending: 0,
      processed: 0,
    }
  }

  const pending = await outbox.findMany({
    where: {
      status: IntegrationOutboxStatus.PENDING,
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

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
        const deliveryAreaConfig = await getIfoodDeliveryAreaConfig()
        let deliveryQuoteId: string | undefined
        let deliveryId: string | undefined
        let deliveryStatus: string | undefined

        if (order.type === 'DELIVERY' && order.address?.trim()) {
          const paymentMethod =
            order.paymentMethod === 'CREDIT' || order.paymentMethod === 'DEBIT'
              ? order.paymentMethod
              : 'CASH'
          const unitPrice = ensureNumber(order.items[0]?.unitPrice ?? ensureNumber(order.total))
          const quantity = Math.max(1, order.items[0]?.quantity ?? 1)
          const price = unitPrice * quantity
          const optionsPrice = Math.max(0, ensureNumber(order.total) - price)
          const totalPrice = ensureNumber(order.total)

          const deliveryAddress = parseDeliveryAddress(order.address, deliveryAreaConfig)
          assertAddressWithinConfiguredArea(deliveryAddress, deliveryAreaConfig)

          const shipping = await requestIfoodDelivery({
            idempotencyKey: item.idempotencyKey,
            merchantId: context.merchantId,
            externalOrderId: order.id,
            orderPayload: {
              customer: {
                name: order.customerName?.trim() || 'Cliente',
                phone: parseCustomerPhone(order.customerPhone),
              },
              delivery: {
                merchantFee: 0,
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
                methods: [
                  paymentMethod === 'CASH'
                    ? {
                        method: paymentMethod,
                        type: 'OFFLINE',
                        value: totalPrice,
                        cash: { changeFor: ensureNumber(order.changeFor ?? totalPrice) },
                      }
                    : {
                        method: paymentMethod,
                        type: 'OFFLINE',
                        value: totalPrice,
                        card: { brand: 'VISA' },
                      },
                ],
              },
            },
          })

          if (!shipping.skipped) {
            deliveryQuoteId = shipping.quoteId
            deliveryId = shipping.deliveryId
            deliveryStatus = shipping.status
          }
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            externalRefs: mergeIfoodRefs(order.externalRefs, {
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
        const ifoodRefs = getIfoodRefs(order.externalRefs)
        const ifoodOrderId = ifoodRefs.ifoodOrderId
        if (typeof ifoodOrderId !== 'string' || !ifoodOrderId) {
          throw new Error('Pedido sem ifoodOrderId para sync de status')
        }
        await updateIfoodOrderStatus({
          ifoodOrderId,
          status: mapLocalStatusToIfood(
            status as 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'
          ),
          idempotencyKey: item.idempotencyKey,
        })
        await prisma.order.update({
          where: { id: order.id },
          data: {
            externalRefs: mergeIfoodRefs(order.externalRefs, {
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
      logIntegration('error', 'Falha ao processar outbox', {
        outboxId: item.id,
        orderId: item.orderId,
        topic: item.topic,
        error: message,
      })
      await markFailed(item.id, item.attempts + 1, message)
    }
  }

  return {
    totalPending: pending.length,
    processed,
  }
}
