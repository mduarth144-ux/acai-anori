import {
  IntegrationOutboxSource,
  IntegrationOutboxStatus,
  IntegrationOutboxTopic,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../prisma'
import { mapLocalStatusToIfood } from './status-map'
import { createIfoodOrder, updateIfoodOrderStatus } from './client'
import { logIntegration } from './logging'
import { mergeIfoodRefs } from './external-refs'

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

async function buildCreatePayload(order: OrderWithItems) {
  const merchantId = process.env.IFOOD_MERCHANT_ID?.trim()
  if (!merchantId) {
    throw new Error('IFOOD_MERCHANT_ID nao configurado')
  }

  return {
    externalOrderId: order.id,
    merchantId,
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail,
    },
    orderType: order.type,
    paymentMethod: order.paymentMethod,
    total: ensureNumber(order.total),
    notes: order.notes,
    items: order.items.map((item) => ({
      id: item.productId,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: ensureNumber(item.unitPrice),
      notes: item.notes,
    })),
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
        const payload = await buildCreatePayload(order)
        const result = await createIfoodOrder(payload, item.idempotencyKey)
        await prisma.order.update({
          where: { id: order.id },
          data: {
            externalRefs: mergeIfoodRefs(order.externalRefs, {
              ifoodOrderId: result.ifoodOrderId,
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
        const ifoodRefs = mergeIfoodRefs(order.externalRefs, {})
        const nested = ifoodRefs.ifood as Record<string, unknown> | undefined
        const ifoodOrderId = nested?.ifoodOrderId
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
