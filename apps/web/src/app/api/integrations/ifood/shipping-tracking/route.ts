import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getIfoodRefs } from '../../../../../lib/integrations/ifood/ifood-response'
import { getShippingOrderTracking } from '../../../../../lib/integrations/ifood/client'

function isAuthorized(request: Request): boolean {
  const sharedSecret = process.env.INTERNAL_JOB_SECRET?.trim()
  const cronSecret = process.env.CRON_SECRET?.trim()
  const validSecrets = [sharedSecret, cronSecret].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
  if (!validSecrets.length) return true

  const provided = request.headers.get('x-job-secret')?.trim()
  if (provided && validSecrets.includes(provided)) return true

  const authHeader = request.headers.get('authorization')?.trim()
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return false

  const bearerToken = authHeader.slice(7).trim()
  return validSecrets.includes(bearerToken)
}

/**
 * Consulta tracking Shipping para o id do pedido no iFood (`ifoodOrderId`).
 * Query: `orderId` = id local do pedido.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }

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
  const ifoodOrderId =
    typeof refs.ifoodOrderId === 'string' && refs.ifoodOrderId.trim().length > 0
      ? refs.ifoodOrderId.trim()
      : typeof refs.shippingOrderId === 'string' && refs.shippingOrderId.trim().length > 0
        ? refs.shippingOrderId.trim()
        : null

  if (!ifoodOrderId) {
    return NextResponse.json(
      { message: 'Pedido sem ifoodOrderId/shippingOrderId para tracking' },
      { status: 422 }
    )
  }

  try {
    const tracking = await getShippingOrderTracking(ifoodOrderId)
    return NextResponse.json({ ok: true, ifoodOrderId, tracking })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar tracking'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
