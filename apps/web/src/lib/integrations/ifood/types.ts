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
  /** Na API iFood o identificador único do evento vem em `id`; `eventId` pode aparecer em outros contextos. */
  id?: string
  eventId?: string
  eventType?: string
  code?: string
  fullCode?: string
  merchantId?: string
  orderId?: string
  status?: string
  occurredAt?: string
  payload?: unknown
}

export type IfoodOrderCreatePayload = {
  /** Id do pedido na tua plataforma — na Order API iFood é a referência do lojista (pedido continua sendo pedido iFood). */
  externalOrderId: string
  merchantId: string
  /** Canal na Order API iFood. Pedidos do site → `DIGITAL_CATALOG` (pedido criado **dentro** do iFood). */
  salesChannel?: string
  /** IMMEDIATE ou SCHEDULED (doc iFood). */
  orderTiming?: string
  /** FOOD, GROCERY, … conforme contrato do merchant. */
  category?: string
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

export type IfoodDeliveryAvailability = {
  id: string
  distance?: number
  expirationAt?: string
  quote?: {
    grossValue?: number
    discount?: number
    netValue?: number
  }
  deliveryTime?: {
    min?: number
    max?: number
  }
}

export type IfoodShippingOrderPayload = {
  customer: {
    name: string
    phone: {
      countryCode: string
      areaCode: string
      number: string
      type: 'CUSTOMER'
    }
  }
  delivery: {
    merchantFee: number
    quoteId?: string
    deliveryAddress: {
      postalCode: string
      streetNumber: string
      streetName: string
      neighborhood: string
      city: string
      state: string
      country: string
      coordinates: {
        latitude: number
        longitude: number
      }
    }
  }
  items: Array<{
    id: string
    name: string
    quantity: number
    unitPrice: number
    price: number
    optionsPrice: number
    totalPrice: number
  }>
  payments: {
    methods: Array<{
      /** Na Shipping API (merchants/.../orders) só CASH ou cartão são aceites; PIX não. */
      method: 'CASH' | 'CREDIT' | 'DEBIT'
      type: 'OFFLINE'
      value: number
      card?: { brand: string }
      cash?: { changeFor: number }
    }>
  }
}
