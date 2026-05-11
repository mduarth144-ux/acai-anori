import type { OrderType, PaymentMethod } from '@prisma/client'
import type { IfoodOrderCreatePayload } from './types'

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

function mapOrderType(type: OrderType): string {
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
    customer: {
      name: order.customerName?.trim() || null,
      phone: order.customerPhone?.trim() || null,
      email: order.customerEmail?.trim() || null,
    },
    orderType: mapOrderType(order.type),
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
