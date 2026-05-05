import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { canTransitionCancellationState, type CancellationState } from '../../../../../lib/integrations/ifood/cancellation-state'
import { mergeIfoodRefs } from '../../../../../lib/integrations/ifood/external-refs'
import {
  listCancellationReasons,
  performCancellationAction,
} from '../../../../../lib/integrations/ifood/client'
import { isIfoodInternalRequestAuthorized } from '../_shared/auth'

export async function GET(request: Request) {
  if (!isIfoodInternalRequestAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('ifoodOrderId')?.trim()
  if (!orderId) {
    return NextResponse.json({ message: 'ifoodOrderId obrigatorio' }, { status: 400 })
  }

  try {
    const data = await listCancellationReasons(orderId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar codigos de cancelamento'
    return NextResponse.json({ message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  if (!isIfoodInternalRequestAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }
  const body = (await request.json()) as {
    action?:
      | 'REQUEST'
      | 'ACCEPT_REQUEST'
      | 'REJECT_REQUEST'
      | 'ACCEPT_AGREEMENT'
      | 'REJECT_AGREEMENT'
      | 'PROPOSAL'
    ifoodOrderId?: string
    reasonCode?: string
    reason?: string
    message?: string
    proposal?: {
      amount?: number
      message?: string
    }
    idempotencyKey?: string
    localOrderId?: string
  }

  if (!body.action || !body.ifoodOrderId) {
    return NextResponse.json({ message: 'action e ifoodOrderId sao obrigatorios' }, { status: 400 })
  }

  try {
    const data = await performCancellationAction(
      body.action,
      {
        orderId: body.ifoodOrderId,
        reasonCode: body.reasonCode,
        reason: body.reason,
        message: body.message,
        proposal: body.proposal,
      },
      body.idempotencyKey?.trim() || `ifood:cancel:${body.ifoodOrderId}:${Date.now()}`
    )

    if (body.localOrderId) {
      const order = await prisma.order.findUnique({ where: { id: body.localOrderId } })
      if (order) {
        const actionToState: Record<NonNullable<typeof body.action>, CancellationState> = {
          REQUEST: 'REQUESTED',
          ACCEPT_REQUEST: 'REQUEST_ACCEPTED',
          REJECT_REQUEST: 'REQUEST_REJECTED',
          ACCEPT_AGREEMENT: 'AGREEMENT_ACCEPTED',
          REJECT_AGREEMENT: 'AGREEMENT_REJECTED',
          PROPOSAL: 'AGREEMENT_PROPOSED',
        }
        const currentState = (
          (order.externalRefs as Record<string, unknown> | null)?.ifood as Record<string, unknown> | undefined
        )?.cancellationState as CancellationState | undefined
        const nextState = actionToState[body.action]
        if (!currentState || canTransitionCancellationState(currentState, nextState)) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              externalRefs: mergeIfoodRefs(order.externalRefs, {
                source: 'internal',
                lastSyncAt: new Date().toISOString(),
                cancellationState: nextState,
              }),
            },
          })
        }
      }
    }

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao executar acao de cancelamento'
    return NextResponse.json({ message }, { status: 502 })
  }
}
