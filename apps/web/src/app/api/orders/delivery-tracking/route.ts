import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { getIfoodRefs, resolveIfoodOrderIdForApis } from '../../../../lib/integrations/ifood/ifood-response'
import { getShippingOrderTracking } from '../../../../lib/integrations/ifood/client'

/**
 * Rastreio Shipping (iFood) para o cliente — mesmo modelo de exposição que `GET /api/orders?id=`
 * (quem conhece o UUID do pedido). Não usar segredo de job no browser.
 *
 * Query: `orderId` = id local do pedido.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const localOrderId = searchParams.get('orderId')?.trim()
  if (!localOrderId) {
    return NextResponse.json({ message: 'orderId obrigatorio' }, { status: 400 })
  }

  const row = await prisma.order.findUnique({
    where: { id: localOrderId },
    select: { ifoodResponse: true },
  })
  const refs = getIfoodRefs(row?.ifoodResponse)
  const trackingKey =
    resolveIfoodOrderIdForApis(refs) ??
    (typeof refs.deliveryId === 'string' && refs.deliveryId.trim().length > 0
      ? refs.deliveryId.trim()
      : undefined) ??
    (typeof refs.shippingOrderId === 'string' && refs.shippingOrderId.trim().length > 0
      ? refs.shippingOrderId.trim()
      : undefined) ??
    null

  if (!trackingKey) {
    return NextResponse.json(
      { ok: false, message: 'Pedido sem ifoodOrderId/shippingOrderId para tracking' },
      { status: 422 }
    )
  }

  try {
    const tracking = await getShippingOrderTracking(trackingKey)
    return NextResponse.json({ ok: true, ifoodOrderId: trackingKey, tracking, fetchedAt: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar tracking'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
