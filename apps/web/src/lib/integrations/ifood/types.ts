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

export type IfoodOrderDetails = {
  id: string
  status?: string
  createdAt?: string
  merchantId?: string
  customer?: Record<string, unknown>
  items?: unknown[]
  [key: string]: unknown
}

export type IfoodCancellationAction =
  | 'REQUEST'
  | 'ACCEPT_REQUEST'
  | 'REJECT_REQUEST'
  | 'ACCEPT_AGREEMENT'
  | 'REJECT_AGREEMENT'
  | 'PROPOSAL'

export type IfoodCancellationPayload = {
  orderId: string
  reasonCode?: string
  reason?: string
  message?: string
  proposal?: {
    amount?: number
    message?: string
  }
}

export type IfoodCatalogEntity = {
  id?: string
  externalCode?: string
  name: string
  description?: string
  status?: 'AVAILABLE' | 'UNAVAILABLE'
  imageUrl?: string
}

export type IfoodCatalogCategory = IfoodCatalogEntity & {
  parentExternalCode?: string
}

export type IfoodCatalogProduct = IfoodCatalogEntity & {
  categoryExternalCode: string
  price: number
}

export type IfoodCatalogItem = IfoodCatalogEntity & {
  productExternalCode: string
  priceModifier?: number
}

export type IfoodCatalogComplement = IfoodCatalogEntity & {
  productExternalCode: string
  minSelect?: number
  maxSelect?: number
}

export type IfoodStoreInterruption = {
  reason: string
  startAt: string
  endAt: string
}
