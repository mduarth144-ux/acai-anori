import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { mapIfoodStatusToLocal } from '../../../../lib/integrations/ifood/status-map'
import { mergeIfoodRefs } from '../../../../lib/integrations/ifood/external-refs'
import { validateIfoodSignature } from '../../../../lib/integrations/ifood/webhook-security'

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

export async function POST(request: Request) {
  const secret = process.env.IFOOD_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ message: 'ifoood webhook secret missing' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-ifood-signature')
  const validSignature = validateIfoodSignature({
    secret,
    rawBody,
    signatureHeader: signature,
  })

  if (!validSignature) {
    return NextResponse.json({ message: 'invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as {
    eventId?: string
    eventType?: string
    merchantId?: string
    orderId?: string
    status?: string
    payload?: unknown
  }

  if (!event.eventId || !event.eventType) {
    return NextResponse.json({ message: 'invalid payload' }, { status: 400 })
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
      eventType: event.eventType,
      merchantId: event.merchantId,
      ifoodOrderId: event.orderId,
      payload: event.payload ?? event,
      payloadHash,
      processingStatus: 'RECEIVED',
    },
  })

  try {
    const externalOrderId = (event.payload as Record<string, unknown> | undefined)
      ?.externalOrderId
    if (typeof externalOrderId !== 'string') {
      throw new Error('Evento sem externalOrderId para correlacao')
    }

    const order = await prisma.order.findUnique({ where: { id: externalOrderId } })
    if (!order) {
      throw new Error('Pedido local nao encontrado para evento iFood')
    }

    if (event.status) {
      const nextStatus = statusToLocal(event.status)
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
    return NextResponse.json({ message }, { status: 422 })
  }

  return NextResponse.json({ ok: true })
}
