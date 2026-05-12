import type { OrderType, PaymentMethod } from '@prisma/client'
import type { IfoodOrderCreatePayload } from './types'

/**
 * Corpo do POST na **Order API do iFood**: o pedido passa a existir no iFood (canal DIGITAL_CATALOG).
 */

type OrderWithItems = {
  id: string
  type: OrderType
  paymentMethod: PaymentMethod
  total: import('@prisma/client/runtime/library').Decimal | number
  customerName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  notes?: string | null
  items: Array<{
    id: string
    quantity: number
    unitPrice: import('@prisma/client/runtime/library').Decimal | number
    notes?: string | null
    product: { name: string }
    choices: unknown
  }>
}

/**
 * Mapeia o tipo do pedido **local** para `orderType` da Order API iFood.
 * Ref.: guia "Detalhes de pedido" — enum inclui DELIVERY, TAKEOUT, DINE_IN, INDOOR (mesa/salão usa INDOOR + objeto `indoor` na resposta).
 */
export function mapLocalOrderTypeToIfoodOrderType(type: OrderType): string {
  switch (type) {
    case 'DELIVERY':
      return 'DELIVERY'
    case 'PICKUP':
      return 'TAKEOUT'
    case 'TABLE':
      return 'INDOOR'
    default:
      return 'DELIVERY'
  }
}

function mapPaymentMethod(pm: PaymentMethod): string {
  switch (pm) {
    case 'PIX':
      return 'PIX'
    case 'CASH':
      return 'CASH'
    case 'CREDIT':
      return 'CREDIT'
    case 'DEBIT':
      return 'DEBIT'
    default:
      return 'CASH'
  }
}

function formatChoicesSummary(choices: unknown): string | null {
  if (choices == null) return null
  if (Array.isArray(choices) && choices.length === 0) return null
  try {
    const s = JSON.stringify(choices)
    return s.length > 400 ? `${s.slice(0, 400)}…` : s
  } catch {
    return null
  }
}

export function buildIfoodOrderCreatePayload(
  order: OrderWithItems,
  merchantId: string
): IfoodOrderCreatePayload {
  const salesChannel =
    process.env.IFOOD_ORDER_SALES_CHANNEL?.trim() || 'DIGITAL_CATALOG'
  const orderTiming = process.env.IFOOD_ORDER_TIMING?.trim() || 'IMMEDIATE'
  const category = process.env.IFOOD_ORDER_CATEGORY?.trim() || 'FOOD'

  const total =
    typeof order.total === 'number' ? order.total : Number(order.total)

  const items = order.items.map((line) => {
    const unit =
      typeof line.unitPrice === 'number' ? line.unitPrice : Number(line.unitPrice)
    const choiceSuffix = formatChoicesSummary(line.choices)
    const notes =
      [line.notes?.trim(), choiceSuffix].filter(Boolean).join(' | ') || undefined
    return {
      id: line.id,
      name: line.product?.name?.trim() || 'Item',
      quantity: Math.max(1, line.quantity),
      unitPrice: unit,
      notes: notes ?? null,
    }
  })

  return {
    externalOrderId: order.id,
    merchantId,
    salesChannel,
    orderTiming,
    category,
    customer: {
      name: order.customerName?.trim() || null,
      phone: order.customerPhone?.trim() || null,
      email: order.customerEmail?.trim() || null,
    },
    orderType: mapLocalOrderTypeToIfoodOrderType(order.type),
    paymentMethod: mapPaymentMethod(order.paymentMethod),
    total,
    notes: order.notes?.trim() || null,
    items: items.length > 0 ? items : [
      {
        id: order.id,
        name: 'Pedido',
        quantity: 1,
        unitPrice: total,
        notes: null,
      },
    ],
  }
}
