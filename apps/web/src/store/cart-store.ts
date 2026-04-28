'use client'

import { create } from 'zustand'

type CartItem = {
  id?: string
  productId: string
  name: string
  unitPrice: number
  quantity: number
  imageUrl?: string | null
  description?: string | null
  notes?: string
  choices?: Array<{ name: string; priceModifier: number }>
}

type OrderType = 'TABLE' | 'DELIVERY' | 'PICKUP'

type CartState = {
  tableCode?: string
  type: OrderType
  items: CartItem[]
  setTableCode: (tableCode?: string) => void
  setType: (type: OrderType) => void
  addItem: (item: CartItem) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  tableCode: undefined,
  type: 'DELIVERY',
  items: [],
  setTableCode: (tableCode) => set({ tableCode }),
  setType: (type) => set({ type }),
  addItem: (item) =>
    set({
      items: [
        ...get().items,
        {
          ...item,
          id: item.id ?? crypto.randomUUID(),
        },
      ],
    }),
  removeItem: (itemId) =>
    set({ items: get().items.filter((item) => item.id !== itemId) }),
  updateQuantity: (itemId, quantity) =>
    set({
      items: quantity <= 0
        ? get().items.filter((item) => item.id !== itemId)
        : get().items.map((item) => item.id === itemId ? { ...item, quantity } : item),
    }),
  clearCart: () => set({ items: [], tableCode: undefined, type: 'DELIVERY' }),
  total: () =>
    get().items.reduce(
      (acc, item) =>
        acc +
        (item.unitPrice + (item.choices?.reduce((c, x) => c + x.priceModifier, 0) ?? 0)) *
          item.quantity,
      0
    ),
}))
