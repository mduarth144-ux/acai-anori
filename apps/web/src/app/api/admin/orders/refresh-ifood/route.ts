import { NextResponse } from 'next/server'
import { refreshOrderStatusFromIfoodApi } from '../../../../../lib/integrations/ifood/sync-order-status-from-ifood'

/**
 * Atualiza estado do pedido a partir de GET Order Details no iFood (painel admin).
 * Proteção real de admin deve ser acrescentada depois; hoje o mesmo modelo que `includeAll` na listagem.
 */
export async function POST(request: Request) {
  let body: { orderId?: string }
  try {
    body = (await request.json()) as { orderId?: string }
  } catch {
    return NextResponse.json({ message: 'JSON inválido' }, { status: 400 })
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  if (!orderId) {
    return NextResponse.json({ message: 'orderId obrigatório' }, { status: 400 })
  }

  try {
    const result = await refreshOrderStatusFromIfoodApi(orderId)
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao sincronizar com iFood'
    return NextResponse.json({ ok: false, message, previousStatus: '', updated: false }, { status: 502 })
  }
}
