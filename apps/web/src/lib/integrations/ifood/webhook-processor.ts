import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { mapIfoodStatusToLocalOptional } from './status-map'
import { getIfoodRefs, mergeIfoodRefs } from './external-refs'
import { logIntegration } from './logging'

export type ParsedIfoodWebhookEvent = {
  eventId?: string
  id?: string
  eventType?: string
  code?: string
  fullCode?: string
  merchantId?: string
  orderId?: string
  status?: string
  payload?: Record<string, unknown>
  externalOrderId?: string
}

export function resolveWebhookEventId(event: ParsedIfoodWebhookEvent): string | undefined {
  const fromEventId =
    typeof event.eventId === 'string' && event.eventId.trim().length > 0
      ? event.eventId.trim()
      : undefined
  if (fromEventId) return fromEventId
  const fromId = typeof event.id === 'string' && event.id.trim().length > 0 ? event.id.trim() : undefined
  return fromId
}

function readExternalOrderId(event: ParsedIfoodWebhookEvent): string | undefined {
  if (typeof event.externalOrderId === 'string' && event.externalOrderId.trim().length > 0) {
    return event.externalOrderId.trim()
  }
  const payloadExternalOrderId = event.payload?.externalOrderId
  if (typeof payloadExternalOrderId === 'string' && payloadExternalOrderId.trim().length > 0) {
    return payloadExternalOrderId.trim()
  }
  return undefined
}

export type ProcessTrustedWebhookResult =
  | { ok: true; deduplicated?: boolean }
  | { ok: false; status: number; message: string }

/**
 * Processa o body de um webhook iFood já validado (assinatura verificada na rota HTTP
 * ou chamada interna confiável como simulação de desenvolvimento).
 */
export async function processTrustedIfoodWebhookRawBody(rawBody: string): Promise<ProcessTrustedWebhookResult> {
  let event: ParsedIfoodWebhookEvent
  try {
    event = JSON.parse(rawBody) as ParsedIfoodWebhookEvent
  } catch {
    return { ok: false, status: 400, message: 'invalid json payload' }
  }

  const eventType = event.eventType ?? event.code ?? event.fullCode ?? 'UNKNOWN'
  /** Preferir status explícito; senão code; fullCode costuma ser ORDER_* (ex.: ORDER_CONCLUDED). */
  const eventStatus = event.status ?? event.code ?? event.fullCode

  function resolveNextLocalStatus(): ReturnType<typeof mapIfoodStatusToLocalOptional> {
    const chain = [event.status, event.code, event.fullCode].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0
    )
    for (const raw of chain) {
      const mapped = mapIfoodStatusToLocalOptional(raw)
      if (mapped !== undefined) return mapped
    }
    return undefined
  }

  const webhookEventId = resolveWebhookEventId(event)
  if (!webhookEventId) {
    return { ok: false, status: 400, message: 'invalid payload: event id is required (id or eventId)' }
  }

  const payloadHash = createHash('sha256').update(rawBody).digest('hex')
  const existing = await prisma.ifoodWebhookEvent.findUnique({
    where: { eventId: webhookEventId },
  })
  if (existing) {
    return { ok: true, deduplicated: true }
  }

  const audit = await prisma.ifoodWebhookEvent.create({
    data: {
      eventId: webhookEventId,
      eventType,
      merchantId: event.merchantId,
      ifoodOrderId: event.orderId,
      payload: (event.payload ?? event) as Prisma.InputJsonValue,
      payloadHash,
      processingStatus: 'RECEIVED',
    },
  })

  try {
    const externalOrderId = readExternalOrderId(event)
    let order =
      externalOrderId !== undefined
        ? await prisma.order.findUnique({ where: { id: externalOrderId } })
        : null

    if (!order && event.orderId) {
      order = await prisma.order.findFirst({
        where: {
          externalRefs: {
            path: ['ifood', 'ifoodOrderId'],
            equals: event.orderId,
          },
        },
      })
    }

    if (!order && event.orderId) {
      order = await prisma.order.findFirst({
        where: {
          externalRefs: {
            path: ['ifood', 'deliveryId'],
            equals: event.orderId,
          },
        },
      })
    }

    if (!order) {
      throw new Error('Pedido local nao encontrado para evento iFood (sem correlacao)')
    }

    if (eventStatus || event.code || event.fullCode || event.status) {
      const nextStatus = resolveNextLocalStatus()
      if (nextStatus !== undefined) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: nextStatus,
            externalRefs: mergeIfoodRefs(order.externalRefs, {
              ifoodOrderId: event.orderId,
              source: 'ifood-webhook',
              lastWebhookEventId: webhookEventId,
              lastSyncAt: new Date().toISOString(),
            }),
          },
        })
      }
    }

    await prisma.ifoodWebhookEvent.update({
      where: { id: audit.id },
      data: {
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar webhook'
    await prisma.ifoodWebhookEvent.update({
      where: { id: audit.id },
      data: {
        processingStatus: 'FAILED',
        processingError: message.slice(0, 1000),
      },
    })
    return { ok: false, status: 422, message }
  }

  return { ok: true }
}

/**
 * Simula um evento de entrega concluída (útil em dev / homologação).
 * Correla o pedido por `externalOrderId` (id local) e repete `orderId` como no shipping (deliveryId quando existir).
 */
export async function runAdminDeliveredIfoodWebhookSimulation(orderId: string): Promise<ProcessTrustedWebhookResult> {
  const merchantId = process.env.IFOOD_MERCHANT_ID?.trim()
  if (!merchantId) {
    logIntegration('warn', 'Simulacao webhook admin: IFOOD_MERCHANT_ID ausente', { orderId })
    return { ok: false, status: 500, message: 'IFOOD_MERCHANT_ID nao configurado' }
  }

  const row = await prisma.order.findUnique({
    where: { id: orderId },
    select: { externalRefs: true },
  })
  const refs = getIfoodRefs(row?.externalRefs)
  const orderIdForWebhook = typeof refs.deliveryId === 'string' && refs.deliveryId.trim().length > 0 ? refs.deliveryId.trim() : orderId

  const payload: ParsedIfoodWebhookEvent = {
    id: randomUUID(),
    code: 'DELIVERED',
    fullCode: 'DELIVERED',
    merchantId,
    orderId: orderIdForWebhook,
    externalOrderId: orderId,
  }

  const rawBody = JSON.stringify(payload)
  const result = await processTrustedIfoodWebhookRawBody(rawBody)
  if (!result.ok) {
    logIntegration('warn', 'Simulacao webhook admin falhou', { orderId, message: result.message })
  } else {
    logIntegration('info', 'Simulacao webhook admin processada', { orderId, deduplicated: result.deduplicated })
  }
  return result
}
