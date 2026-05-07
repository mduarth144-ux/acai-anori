import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { mapIfoodStatusToLocal } from '../../../../lib/integrations/ifood/status-map'
import { mergeIfoodRefs } from '../../../../lib/integrations/ifood/external-refs'
import { validateIfoodSignature } from '../../../../lib/integrations/ifood/webhook-security'

type ParsedIfoodWebhookEvent = {
  eventId?: string
  eventType?: string
  fullCode?: string
  merchantId?: string
  orderId?: string
  status?: string
  payload?: Record<string, unknown>
  externalOrderId?: string
}

function statusToLocal(status: string) {
  const normalized = status as
    | 'PLACED'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
  return mapIfoodStatusToLocal(normalized)
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ message, error: message }, { status })
}

function readExternalOrderId(event: ParsedIfoodWebhookEvent): string | undefined {
  if (typeof event.externalOrderId === 'string' && event.externalOrderId.trim().length > 0) {
    return event.externalOrderId
  }
  const payloadExternalOrderId = event.payload?.externalOrderId
  if (typeof payloadExternalOrderId === 'string' && payloadExternalOrderId.trim().length > 0) {
    return payloadExternalOrderId
  }
  return undefined
}

export async function POST(request: Request) {
  const secret = process.env.IFOOD_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return errorResponse(500, 'ifood webhook secret missing')
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-ifood-signature')
  const validSignature = validateIfoodSignature({
    secret,
    rawBody,
    signatureHeader: signature,
  })

  if (!validSignature) {
    return errorResponse(401, 'invalid signature')
  }

  let event: ParsedIfoodWebhookEvent
  try {
    event = JSON.parse(rawBody) as ParsedIfoodWebhookEvent
  } catch {
    return errorResponse(400, 'invalid json payload')
  }

  const eventType = event.eventType ?? event.fullCode ?? 'UNKNOWN'
  const eventStatus = event.status ?? event.fullCode

  if (!event.eventId) {
    return errorResponse(400, 'invalid payload: eventId is required')
  }

  const payloadHash = createHash('sha256').update(rawBody).digest('hex')
  const existing = await prisma.ifoodWebhookEvent.findUnique({
    where: { eventId: event.eventId },
  })
  if (existing) {
    return NextResponse.json({ ok: true, deduplicated: true })
  }

  const audit = await prisma.ifoodWebhookEvent.create({
    data: {
      eventId: event.eventId,
      eventType,
      merchantId: event.merchantId,
      ifoodOrderId: event.orderId,
      payload: event.payload ?? event,
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

    if (!order) {
      throw new Error('Pedido local nao encontrado para evento iFood (sem correlacao)')
    }

    if (eventStatus) {
      const nextStatus = statusToLocal(eventStatus)
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          externalRefs: mergeIfoodRefs(order.externalRefs, {
            ifoodOrderId: event.orderId,
            source: 'ifood-webhook',
            lastWebhookEventId: event.eventId,
            lastSyncAt: new Date().toISOString(),
          }),
        },
      })
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
    return errorResponse(422, message)
  }

  return NextResponse.json({ ok: true })
}
