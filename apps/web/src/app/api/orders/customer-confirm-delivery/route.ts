import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyCustomerDeliveryToken, getCustomerOrderActionSecret } from '../../../../lib/customer-delivery-token'
import { isValidLocalTransition } from '../../../../lib/integrations/ifood/status-map'
import type { LocalOrderStatus } from '../../../../lib/integrations/ifood/types'
import { enqueueStatusUpdate } from '../../../../lib/integrations/ifood/outbox'
import { mergeCustomerDeliveryConfirmation } from '../../../../lib/order-integration-meta'

export async function POST(request: Request) {
  if (!getCustomerOrderActionSecret()) {
    return NextResponse.json(
      { message: 'Confirmacao pelo cliente nao esta habilitada (CUSTOMER_ORDER_ACTION_SECRET).' },
      { status: 503 }
    )
  }

  const body = (await request.json()) as { orderId?: string; token?: string }
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!orderId || !token) {
    return NextResponse.json({ message: 'orderId e token sao obrigatorios' }, { status: 400 })
  }

  const verified = verifyCustomerDeliveryToken(token)
  if (!verified || verified.orderId !== orderId) {
    return NextResponse.json({ message: 'Token invalido ou expirado' }, { status: 403 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) {
    return NextResponse.json({ message: 'Pedido nao encontrado' }, { status: 404 })
  }

  if (order.type !== 'DELIVERY') {
    return NextResponse.json({ message: 'Somente pedidos de entrega podem ser confirmados assim' }, { status: 409 })
  }

  if (order.status === 'DELIVERED') {
    return NextResponse.json({ ok: true, alreadyDelivered: true })
  }

  const currentStatus = order.status as LocalOrderStatus
  if (!isValidLocalTransition(currentStatus, 'DELIVERED')) {
    return NextResponse.json(
      {
        message:
          'Ainda nao e possivel confirmar a entrega neste status. Aguarde o pedido sair para entrega ou fale com a loja.',
      },
      { status: 409 }
    )
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'DELIVERED',
      integrationMeta: mergeCustomerDeliveryConfirmation(order.integrationMeta),
    },
  })

  await enqueueStatusUpdate({
    orderId,
    status: 'DELIVERED',
    source: 'INTERNAL',
  })

  return NextResponse.json(updated)
}
