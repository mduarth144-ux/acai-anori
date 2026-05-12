import { IntegrationOutboxTopic, type OrderStatus } from '@prisma/client'
import { prisma } from '../../prisma'
import { getIfoodOrderDetails } from './client'
import { getIfoodRefs, mergeIfoodRefs, resolveIfoodOrderIdForApis } from './ifood-response'
import { mapIfoodStatusToLocalOptional } from './status-map'
import type { LocalOrderStatus } from './types'
import { processOutboxBatch, recoverIfoodIntegrationOutboxForOrder } from './outbox'

const RANK: Record<LocalOrderStatus, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PREPARING: 2,
  READY: 3,
  DELIVERED: 4,
  CANCELLED: -1,
}

function extractIfoodOrderStatus(details: unknown): string | undefined {
  if (!details || typeof details !== 'object') return undefined
  const o = details as Record<string, unknown>
  const s = o.status
  if (typeof s === 'string' && s.trim().length > 0) return s.trim()
  return undefined
}

export type RefreshOrderFromIfoodOutboxCreate = {
  status: string
  lastError: string | null
  nextAttemptAt: string | null
  attempts: number
}

export type RefreshOrderFromIfoodResult = {
  ok: boolean
  message?: string
  previousStatus: string
  newStatus?: string
  ifoodRawStatus?: string
  updated: boolean
  /** True quando corremos `processOutboxBatch` por ainda não haver id iFood. */
  outboxAttempted?: boolean
  /** Após `recoverIfoodIntegrationOutboxForOrder` + batch (só quando faltava id). */
  outboxRecovery?: {
    stuckProcessingReset: number
    failedCreateRequeued: boolean
    failedCreateLastError: string | null
  }
  /** Última linha IFOOD_ORDER_CREATE na outbox (diagnóstico quando ainda sem id). */
  outboxCreate?: RefreshOrderFromIfoodOutboxCreate
}

/**
 * Lê GET Order Details no iFood e alinha o estado **local** ao pedido **já criado no iFood**
 * quando o iFood está à frente (ou cancelado). Não faz downgrade de estado avançado para
 * anterior, exceto cancelamento.
 */
export async function refreshOrderStatusFromIfoodApi(orderId: string): Promise<RefreshOrderFromIfoodResult> {
  let order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) {
    return { ok: false, message: 'Pedido não encontrado', previousStatus: '', updated: false }
  }

  let refs = getIfoodRefs(order.ifoodResponse)
  let ifoodOrderId = resolveIfoodOrderIdForApis(refs)
  let outboxAttempted = false
  let outboxRecovery:
    | {
        stuckProcessingReset: number
        failedCreateRequeued: boolean
        failedCreateLastError: string | null
      }
    | undefined

  const persistRecoveredId = async (id: string) => {
    const row = await prisma.order.findUnique({
      where: { id: orderId },
      select: { ifoodResponse: true },
    })
    await prisma.order.update({
      where: { id: orderId },
      data: {
        ifoodResponse: mergeIfoodRefs(row?.ifoodResponse ?? {}, { ifoodOrderId: id }),
      },
    })
    order = await prisma.order.findUnique({ where: { id: orderId } })
    if (order) refs = getIfoodRefs(order.ifoodResponse)
  }

  if (!ifoodOrderId) {
    outboxRecovery = await recoverIfoodIntegrationOutboxForOrder(orderId)
    await processOutboxBatch(40, { prioritizeOrderId: orderId })
    outboxAttempted = true
    order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      return { ok: false, message: 'Pedido não encontrado', previousStatus: '', updated: false, outboxAttempted }
    }
    refs = getIfoodRefs(order.ifoodResponse)
    ifoodOrderId = resolveIfoodOrderIdForApis(refs)
  }

  if (!ifoodOrderId) {
    const createRow = await prisma.integrationOutbox.findFirst({
      where: { orderId, topic: IntegrationOutboxTopic.IFOOD_ORDER_CREATE },
      orderBy: { updatedAt: 'desc' },
      select: { status: true, lastError: true, nextAttemptAt: true, attempts: true },
    })
    const syncErr =
      typeof refs.syncError === 'string' && refs.syncError.trim().length > 0
        ? refs.syncError.trim()
        : null

    const parts: string[] = [
      'Ainda não há ifoodOrderId gravado: o pedido da plataforma deve ser criado na Order API do iFood (canal DIGITAL_CATALOG); o id vem na resposta e fica em `Order.ifoodResponse` até o outbox concluir.',
    ]
    if (syncErr) parts.push(`Erro de sincronização gravado em \`Order.ifoodResponse\`: ${syncErr}.`)
    if (createRow) {
      const next = createRow.nextAttemptAt ? createRow.nextAttemptAt.toISOString() : null
      parts.push(
        `Outbox IFOOD_ORDER_CREATE: ${createRow.status}, tentativas ${createRow.attempts}.${createRow.lastError ? ` Último erro: ${createRow.lastError}.` : ''}${next ? ` Próxima tentativa: ${next}.` : ''}`
      )
    } else {
      parts.push(
        'Não há linha IFOOD_ORDER_CREATE na outbox para este pedido (a publicação na Order API iFood pode não ter sido enfileirada).'
      )
    }

    return {
      ok: false,
      message: parts.join(' '),
      previousStatus: order.status,
      updated: false,
      outboxAttempted,
      outboxRecovery,
      outboxCreate: createRow
        ? {
            status: createRow.status,
            lastError: createRow.lastError,
            nextAttemptAt: createRow.nextAttemptAt?.toISOString() ?? null,
            attempts: createRow.attempts,
          }
        : undefined,
    }
  }

  if (typeof refs.ifoodOrderId !== 'string' || !refs.ifoodOrderId.trim()) {
    await persistRecoveredId(ifoodOrderId)
  }

  const details = await getIfoodOrderDetails(ifoodOrderId)
  const raw = extractIfoodOrderStatus(details)
  if (!raw) {
    return {
      ok: true,
      previousStatus: order.status,
      message: 'Resposta iFood sem campo status',
      updated: false,
    }
  }

  const nextLocal = mapIfoodStatusToLocalOptional(raw)
  if (!nextLocal) {
    return {
      ok: true,
      previousStatus: order.status,
      ifoodRawStatus: raw,
      message: `Status iFood não mapeado: ${raw}`,
      updated: false,
    }
  }

  const current = order.status as LocalOrderStatus
  const syncMeta = {
    lastIfoodOrderStatus: raw,
    lastOrderDetailsSyncAt: new Date().toISOString(),
  }

  if (nextLocal === current) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        ifoodResponse: mergeIfoodRefs(order.ifoodResponse, syncMeta),
      },
    })
    return {
      ok: true,
      previousStatus: current,
      newStatus: current,
      ifoodRawStatus: raw,
      updated: false,
    }
  }

  if (nextLocal === 'CANCELLED') {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED' as OrderStatus,
        ifoodResponse: mergeIfoodRefs(order.ifoodResponse, {
          ...syncMeta,
          source: 'internal',
        }),
      },
    })
    return {
      ok: true,
      previousStatus: current,
      newStatus: 'CANCELLED',
      ifoodRawStatus: raw,
      updated: true,
    }
  }

  if (current === 'CANCELLED') {
    return {
      ok: true,
      previousStatus: current,
      ifoodRawStatus: raw,
      message: 'Pedido local já cancelado; não alterado.',
      updated: false,
    }
  }

  if (RANK[nextLocal] > RANK[current]) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: nextLocal as OrderStatus,
        ifoodResponse: mergeIfoodRefs(order.ifoodResponse, {
          ...syncMeta,
          source: 'internal',
        }),
      },
    })
    return {
      ok: true,
      previousStatus: current,
      newStatus: nextLocal,
      ifoodRawStatus: raw,
      updated: true,
    }
  }

  return {
    ok: true,
    previousStatus: current,
    ifoodRawStatus: raw,
    message: `Estado local (${current}) já está à frente ou em conflito com iFood (${raw}); não alterado.`,
    updated: false,
  }
}
