import { NextResponse } from 'next/server'
import {
  getIfoodOrderDetails,
  notifyOrderOutForDelivery,
  notifyOrderReadyForPickup,
  updateIfoodOrderStatus,
} from '../../../../../lib/integrations/ifood/client'
import { isIfoodInternalRequestAuthorized } from '../_shared/auth'

export async function GET(request: Request) {
  if (!isIfoodInternalRequestAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const ifoodOrderId = searchParams.get('ifoodOrderId')?.trim()
  if (!ifoodOrderId) {
    return NextResponse.json({ message: 'ifoodOrderId obrigatorio' }, { status: 400 })
  }

  try {
    const data = await getIfoodOrderDetails(ifoodOrderId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar pedido iFood'
    return NextResponse.json({ message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  if (!isIfoodInternalRequestAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    action?: 'START_PREPARATION' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY'
    ifoodOrderId?: string
    idempotencyKey?: string
  }
  const ifoodOrderId = body.ifoodOrderId?.trim()
  if (!ifoodOrderId || !body.action) {
    return NextResponse.json({ message: 'action e ifoodOrderId sao obrigatorios' }, { status: 400 })
  }
  const key = body.idempotencyKey?.trim() || `ifood:order:op:${ifoodOrderId}:${Date.now()}`

  try {
    if (body.action === 'START_PREPARATION') {
      await updateIfoodOrderStatus({
        ifoodOrderId,
        status: 'PREPARING',
        idempotencyKey: key,
      })
    } else if (body.action === 'READY_FOR_PICKUP') {
      await notifyOrderReadyForPickup(ifoodOrderId, key)
    } else {
      await notifyOrderOutForDelivery(ifoodOrderId, key)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao executar operacao de pedido iFood'
    return NextResponse.json({ message }, { status: 502 })
  }
}
