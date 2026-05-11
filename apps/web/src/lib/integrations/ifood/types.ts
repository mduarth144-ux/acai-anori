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
      method: 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX'
      type: 'OFFLINE'
      value: number
      card?: { brand: string }
      cash?: { changeFor: number }
    }>
  }
}
