import { NextResponse } from 'next/server'
import {
  createStoreInterruption,
  deleteStoreInterruption,
  getStoreDetails,
  getStoreOperatingHours,
  listStoreInterruptions,
  updateStoreOperatingHours,
} from '../../../../../lib/integrations/ifood/client'
import { isIfoodInternalRequestAuthorized } from '../_shared/auth'

export async function GET(request: Request) {
  if (!isIfoodInternalRequestAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')?.trim() || 'details'

  try {
    if (action === 'details') {
      return NextResponse.json({ ok: true, data: await getStoreDetails() })
    }
    if (action === 'hours') {
      return NextResponse.json({ ok: true, data: await getStoreOperatingHours() })
    }
    if (action === 'interruptions') {
      return NextResponse.json({ ok: true, data: await listStoreInterruptions() })
    }
    return NextResponse.json({ message: 'acao invalida' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar dados da loja iFood'
    return NextResponse.json({ message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  if (!isIfoodInternalRequestAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }
  const body = (await request.json()) as {
    action?: 'SET_HOURS' | 'CREATE_INTERRUPTION' | 'DELETE_INTERRUPTION'
    payload?: Record<string, unknown>
    interruptionId?: string
  }

  try {
    if (body.action === 'SET_HOURS') {
      return NextResponse.json({
        ok: true,
        data: await updateStoreOperatingHours(body.payload ?? {}),
      })
    }
    if (body.action === 'CREATE_INTERRUPTION') {
      const payload = body.payload as { reason?: string; startAt?: string; endAt?: string }
      if (!payload?.reason || !payload.startAt || !payload.endAt) {
        return NextResponse.json(
          { message: 'reason, startAt e endAt sao obrigatorios para criar interrupcao' },
          { status: 400 }
        )
      }
      return NextResponse.json({
        ok: true,
        data: await createStoreInterruption({
          reason: payload.reason,
          startAt: payload.startAt,
          endAt: payload.endAt,
        }),
      })
    }
    if (body.action === 'DELETE_INTERRUPTION') {
      if (!body.interruptionId) {
        return NextResponse.json({ message: 'interruptionId obrigatorio' }, { status: 400 })
      }
      await deleteStoreInterruption(body.interruptionId)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ message: 'acao invalida' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao executar operacao de loja iFood'
    return NextResponse.json({ message }, { status: 502 })
  }
}
