export type LocalOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED'

export type IfoodOrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

export type IfoodWebhookEvent = {
  eventId: string
  eventType: string
  merchantId?: string
  orderId?: string
  status?: string
  occurredAt?: string
  payload?: unknown
}

export type IfoodOrderCreatePayload = {
  externalOrderId: string
  merchantId: string
  customer: {
    name?: string | null
    phone?: string | null
    email?: string | null
  }
  orderType: string
  paymentMethod: string
  total: number
  notes?: string | null
  items: Array<{
    id: string
    name: string
    quantity: number
    unitPrice: number
    notes?: string | null
  }>
}

export type IfoodShippingQuotePayload = {
  merchantId: string
  externalOrderId: string
  orderValue: number
  pickupAddress: string
  deliveryAddress: string
}

export type IfoodShippingOrderPayload = {
  merchantId: string
  externalOrderId: string
  quoteId: string
  recipient: {
    name?: string | null
    phone?: string | null
  }
  notes?: string | null
}
