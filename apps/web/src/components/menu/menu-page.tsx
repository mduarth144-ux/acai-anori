'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, ChefHat, Clock3, Plus, Truck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemedSelect } from '../ui/themed-select'
import { useCartStore } from '../../store/cart-store'
import { orderStatusLabel } from '../../lib/order-labels'

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  type?: 'FINAL' | 'COMPOSED' | 'ACCOMPANIMENT'
  selectionTitle?: string | null
  category: { id: string; name: string; slug: string }
  customizations: ProductCustomization[]
}

type Category = { id: string; name: string; slug: string }
type ProductCustomization = {
  id: string
  label: string
  required: boolean
  minSelect?: number
  maxSelect?: number | null
  affectsPrice?: boolean
  freeQuantity?: number
  options: Array<{
    id: string
    name: string
    priceModifier: number
    optionProduct?: { id: string; name: string } | null
  }>
}

type Props = {
  categories: Category[]
  products: Product[]
  tableCode?: string
}

const PRODUCTS_BATCH_SIZE = 8
const ORDERS_STORAGE_KEY = 'orders.history.v1'
const CHECKOUT_PROFILE_STORAGE_KEY = 'checkout.profile.v1'
const ACTIVE_ORDER_STATUS = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY'])
const TIMELINE_STEPS = [
  { id: 'PENDING', label: 'Pedido recebido', shortLabel: 'Pedido', Icon: Clock3 },
  { id: 'PREPARING', label: 'Pedido em preparo', shortLabel: 'Preparo', Icon: ChefHat },
  { id: 'READY', label: 'Saiu para entrega', shortLabel: 'Caminho', Icon: Truck },
  { id: 'DELIVERED', label: 'Entregue', shortLabel: 'Entregue', Icon: CheckCircle2 },
] as const

type ActiveOrder = {
  id: string
  status: string
}

export function MenuPage({ categories, products, tableCode }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_BATCH_SIZE)
  const [wizardProduct, setWizardProduct] = useState<Product | null>(null)
  const [selectedChoicesByCustomization, setSelectedChoicesByCustomization] = useState<Record<string, string[]>>({})
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const addItem = useCartStore((state) => state.addItem)
  const items = useCartStore((state) => state.items)
  const total = useCartStore((state) => state.total)
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0)
  const bestSellerNames = [
    'Açaí Frozen Tradicional',
    'Açaí Frozen Especial',
    'Açaí Frozen Mix',
  ]
  const storefrontProducts = useMemo(
    () => products.filter((product) => product.type !== 'ACCOMPANIMENT'),
    [products]
  )

  const filtered = useMemo(() => {
    const frozenPriority = ['tradicional', 'especial', 'casadinha', 'mix', 'litro']

    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

    const ranked = storefrontProducts
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => {
        const categoryMatch = activeCategory === 'all' || product.category.slug === activeCategory
        const queryMatch = normalize(product.name).includes(normalize(query))
        return categoryMatch && queryMatch
      })
      .sort((a, b) => {
        const aText = normalize(`${a.product.name} ${a.product.description ?? ''} ${a.product.category.name}`)
        const bText = normalize(`${b.product.name} ${b.product.description ?? ''} ${b.product.category.name}`)
        const aIsFrozen = aText.includes('frozen')
        const bIsFrozen = bText.includes('frozen')

        if (aIsFrozen !== bIsFrozen) return aIsFrozen ? -1 : 1

        if (aIsFrozen && bIsFrozen) {
          const rankOf = (text: string) => {
            const idx = frozenPriority.findIndex((tag) => text.includes(tag))
            return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
          }
          const rankDiff = rankOf(aText) - rankOf(bText)
          if (rankDiff !== 0) return rankDiff
        }

        return a.index - b.index
      })

    return ranked.map(({ product }) => product)
  }, [activeCategory, storefrontProducts, query])

  const bestSellers = useMemo(
    () =>
      bestSellerNames
        .map((name) => storefrontProducts.find((product) => product.name === name))
        .filter((product): product is Product => Boolean(product)),
    [storefrontProducts]
  )
  const shouldShowBestSellers = activeCategory === 'all' && query.trim().length === 0
  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  )
  const visibleProductsByCategory = useMemo(() => {
    const grouped = new Map<string, { category: Category; products: Product[] }>()
    const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]))

    for (const product of visibleProducts) {
      const slug = product.category.slug
      const category =
        categoriesBySlug.get(slug) ?? { id: product.category.id, name: product.category.name, slug }
      const bucket = grouped.get(slug)
      if (bucket) {
        bucket.products.push(product)
      } else {
        grouped.set(slug, { category, products: [product] })
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) =>
        categories.findIndex((category) => category.slug === a.category.slug) -
        categories.findIndex((category) => category.slug === b.category.slug)
    )
  }, [categories, visibleProducts])
  const hasMoreProducts = visibleCount < filtered.length

  useEffect(() => {
    setVisibleCount(PRODUCTS_BATCH_SIZE)
  }, [activeCategory, query])

  useEffect(() => {
    const observerTarget = loadMoreRef.current
    if (!observerTarget || !hasMoreProducts) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisibleCount((current) =>
          Math.min(current + PRODUCTS_BATCH_SIZE, filtered.length)
        )
      },
      { rootMargin: '240px 0px' }
    )

    observer.observe(observerTarget)
    return () => observer.disconnect()
  }, [filtered.length, hasMoreProducts, visibleCount])

  useEffect(() => {
    let isMounted = true

    async function loadActiveOrder() {
      if (typeof window === 'undefined') return
      try {
        const rawCheckout = window.localStorage.getItem(CHECKOUT_PROFILE_STORAGE_KEY)
        const checkout = rawCheckout
          ? (JSON.parse(rawCheckout) as { customerPhone?: string; customerEmail?: string })
          : {}

        const params = new URLSearchParams()
        if (checkout.customerPhone?.trim()) params.set('phone', checkout.customerPhone.trim())
        if (checkout.customerEmail?.trim()) params.set('email', checkout.customerEmail.trim())

        const url = params.size > 0 ? `/api/orders?${params.toString()}` : '/api/orders'
        const response = await fetch(url)
        if (!response.ok) return
        const serverOrders = (await response.json()) as Array<{ id: string; status: string }>

        const rawHistory = window.localStorage.getItem(ORDERS_STORAGE_KEY)
        const historyIds = rawHistory
          ? (JSON.parse(rawHistory) as Array<{ id: string }>).map((item) => String(item.id))
          : []

        const candidateOrders = historyIds.length
          ? historyIds
              .map((id) => serverOrders.find((order) => order.id === id))
              .filter((order): order is { id: string; status: string } => Boolean(order))
          : serverOrders

        const found = candidateOrders.find((order) => ACTIVE_ORDER_STATUS.has(String(order.status)))
        if (isMounted) {
          setActiveOrder(found ? { id: String(found.id), status: String(found.status) } : null)
        }
      } catch {
        if (isMounted) setActiveOrder(null)
      }
    }

    void loadActiveOrder()
    return () => {
      isMounted = false
    }
  }, [])

  function closeWizard() {
    setWizardProduct(null)
    setWizardError(null)
    setSelectedChoicesByCustomization({})
  }

  function addSimpleItem(product: Product) {
    addItem({
      productId: product.id,
      name: product.name,
      quantity: 1,
      unitPrice: product.price,
      imageUrl: product.imageUrl,
      description: product.description,
    })
  }

  function startWizard(product: Product) {
    if (!product.customizations || product.customizations.length === 0) {
      addSimpleItem(product)
      return
    }
    setWizardProduct(product)
    setWizardError(null)
    setSelectedChoicesByCustomization({})
  }

  function toggleChoice(customizationId: string, optionId: string) {
    if (!wizardProduct) return
    const customization = wizardProduct.customizations.find((item) => item.id === customizationId)
    if (!customization) return
    setSelectedChoicesByCustomization((prev) => {
      const selected = new Set(prev[customizationId] ?? [])
      const maxSelect = customization.maxSelect ?? null
      if (selected.has(optionId)) {
        selected.delete(optionId)
      } else {
        if (typeof maxSelect === 'number' && maxSelect > 0 && selected.size >= maxSelect) {
          setWizardError(`No grupo "${customization.label}", selecione no máximo ${maxSelect} item(ns).`)
          return prev
        }
        selected.add(optionId)
      }
      return {
        ...prev,
        [customizationId]: Array.from(selected),
      }
    })
    if (wizardError) setWizardError(null)
  }

  function addWizardItemToCart() {
    if (!wizardProduct) return
    for (const customization of wizardProduct.customizations) {
      const minSelect = Math.max(
        0,
        customization.minSelect ?? (customization.required ? 1 : 0)
      )
      const maxSelect = customization.maxSelect ?? null
      const selectedCount =
        selectedChoicesByCustomization[customization.id]?.length ?? 0

      if (selectedCount < minSelect) {
        setWizardError(
          `No grupo "${customization.label}", selecione pelo menos ${minSelect} item(ns).`
        )
        return
      }
      if (typeof maxSelect === 'number' && maxSelect > 0 && selectedCount > maxSelect) {
        setWizardError(
          `No grupo "${customization.label}", selecione no máximo ${maxSelect} item(ns).`
        )
        return
      }
    }

    const allChoices = wizardProduct.customizations.flatMap((customization) => {
      const selectedIds = new Set(selectedChoicesByCustomization[customization.id] ?? [])
      let freeSlotsRemaining =
        customization.affectsPrice === false ? Number.MAX_SAFE_INTEGER : Math.max(0, customization.freeQuantity ?? 0)
      return customization.options
        .filter((option) => selectedIds.has(option.id))
        .map((option) => ({
          name: option.optionProduct?.name ?? option.name,
          priceModifier: (() => {
            if (customization.affectsPrice === false) return 0
            if (freeSlotsRemaining > 0) {
              freeSlotsRemaining -= 1
              return 0
            }
            return option.priceModifier
          })(),
        }))
    })

    addItem({
      productId: wizardProduct.id,
      name: wizardProduct.name,
      quantity: 1,
      unitPrice: wizardProduct.price,
      imageUrl: wizardProduct.imageUrl,
      description: wizardProduct.description,
      choices: allChoices,
    })
    closeWizard()
  }

  const timelineIndex = (() => {
    if (!activeOrder) return -1
    if (activeOrder.status === 'CONFIRMED') return 1
    return Math.max(TIMELINE_STEPS.findIndex((step) => step.id === activeOrder.status), 0)
  })()

  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="mb-6 rounded-2xl bg-gradient-to-br from-fuchsia-950 via-purple-950 to-acai-950 p-6 text-acai-50 shadow-lg ring-1 ring-fuchsia-900/40">
        <div className="flex items-center justify-between gap-3">
        <div className="text-left">
            <h1 className="text-xl font-bold">Cardápio Online</h1>
            <p className="mt-1 text-sm text-fuchsia-200/90">
              Açaí em Litro e Açaí Frozen para você e sua família receberem em sua casa
            </p>
          </div>
          <Image
            src="/brand/logo.png"
            alt="Logo Anori Açaí Frozen"
            width={220}
            height={70}
            className="h-14 w-auto rounded-xl bg-acai-950/60 p-2 ring-1 ring-white/15 sm:h-16"
          />
        </div>
        {tableCode ? <p className="mt-3 text-sm text-acai-100">Pedido em mesa: <b>{tableCode}</b></p> : null}
      </header>

      {activeOrder ? (
        <section className="border-acai-600 bg-acai-800/90 mb-6 rounded-2xl border p-4 shadow-lg ring-1 ring-fuchsia-900/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-fuchsia-200 text-sm font-semibold">Pedido em andamento</p>
              <p className="text-acai-300 mt-1 text-xs">
                Acompanhe seu pedido #{activeOrder.id} - {orderStatusLabel(activeOrder.status)}
              </p>

              <ol className="mt-4 flex items-start gap-0 overflow-x-auto px-1 py-1">
                {TIMELINE_STEPS.map((step, index) => {
                  const done = index <= timelineIndex
                  const active = index === timelineIndex
                  return (
                    <li key={step.id} className="relative flex min-w-[76px] flex-col items-center">
                      <div className="relative z-10 flex w-full justify-center">
                        <span
                          className={[
                            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                            done
                              ? 'border-fuchsia-500 bg-fuchsia-600 text-white'
                              : 'border-acai-600 bg-acai-900 text-acai-400',
                            active ? 'ring-2 ring-fuchsia-300/70' : '',
                          ].join(' ')}
                          title={step.label}
                          aria-label={step.label}
                        >
                          <step.Icon className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      {index < TIMELINE_STEPS.length - 1 ? (
                        <span
                          className={[
                            'absolute top-4 left-1/2 ml-4 h-[2px] w-[calc(100%-2rem)] rounded-full',
                            index < timelineIndex ? 'bg-fuchsia-500' : 'bg-acai-700',
                          ].join(' ')}
                        />
                      ) : null}
                      <span
                        className={[
                          'mt-1 text-[10px] leading-none',
                          done ? 'text-acai-200' : 'text-acai-400',
                          active ? 'font-semibold text-fuchsia-300' : '',
                        ].join(' ')}
                      >
                        {step.shortLabel}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>

            <Link
              href={`/pedido/${activeOrder.id}`}
              className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 lg:w-auto"
            >
              Voltar ao acompanhamento
            </Link>
          </div>
        </section>
      ) : null}

      <div className="mb-4">
        <label htmlFor="category-filter" className="mb-2 block text-sm font-medium text-fuchsia-200/90">
          Categoria
        </label>
        <ThemedSelect
          id="category-filter"
          value={activeCategory}
          onChange={(nextValue) => setActiveCategory(nextValue)}
          className="w-full"
          options={[
            { value: 'all', label: 'Todas' },
            ...categories.map((category) => ({
              value: category.slug,
              label: category.name,
            })),
          ]}
        />
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" className="mb-6 w-full rounded-xl p-3" />

      {shouldShowBestSellers && bestSellers.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 text-xl font-bold text-fuchsia-100">Os mais pedidos</h2>
          <div className="grid grid-cols-3 gap-3">
            {bestSellers.map((product) => (
              <article key={`best-${product.id}`} className="flex h-full flex-col rounded-xl border border-acai-600 bg-acai-900/60 p-2">
                <div className="mb-2 h-16 overflow-hidden rounded-lg bg-acai-900 sm:h-20 md:h-32 lg:h-36">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={400}
                      height={200}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-acai-400">
                      Sem imagem
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-fuchsia-100">{product.name}</h3>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="text-sm font-bold text-fuchsia-300">
                    R$ {product.price.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startWizard(product)}
                    className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-fuchsia-500"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-8">
        {visibleProductsByCategory.map(({ category, products: categoryProducts }) => (
          <section key={category.slug} className="rounded-2xl border border-acai-700/70 bg-acai-900/40 p-4 shadow-lg ring-1 ring-acai-700/40">
            <h2 className="mb-4 text-xl font-bold text-fuchsia-100">{category.name}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {categoryProducts.map((product) => (
                <article key={product.id} className="flex h-full flex-col rounded-2xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg shadow-black/20 ring-1 ring-acai-700/50">
                  <div className="mb-3 h-40 overflow-hidden rounded-xl bg-acai-900">
                    {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={600} height={300} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-acai-400">Sem imagem</div>}
                  </div>
                  <h3 className="text-xl font-semibold text-fuchsia-100">{product.name}</h3>
                  <p className="my-2 text-sm text-acai-300">{product.description ?? 'Açaí artesanal com ingredientes selecionados.'}</p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-bold text-fuchsia-300">R$ {product.price.toFixed(2)}</span>
                    <button
                      onClick={() => startWizard(product)}
                      className="rounded-lg bg-fuchsia-600 px-3 py-2 text-sm text-white shadow hover:bg-fuchsia-500"
                    >
                      Adicionar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div ref={loadMoreRef} className="h-4 w-full" />
      {hasMoreProducts ? (
        <p className="mt-2 text-center text-sm text-acai-400">
          Carregando mais coisas deliciosas...
        </p>
      ) : null}

      {itemCount > 0 && (
        <div className="sticky bottom-2 mt-8 rounded-2xl border border-acai-600 bg-gradient-to-r from-acai-900 via-purple-950 to-acai-950 p-4 text-acai-50 shadow-2xl shadow-black/40 ring-1 ring-fuchsia-900/30">
          <div className="mb-2 flex items-center justify-between text-sm text-fuchsia-200">
            <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'} no pedido</span>
            <span className="font-semibold">R$ {total().toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Link
              href={tableCode ? `/carrinho?mesa=${tableCode}` : '/carrinho'}
              className="flex-1 rounded-lg border border-fuchsia-400/50 px-4 py-2 text-center text-sm font-medium text-acai-50 hover:bg-acai-800/80"
            >
              Ver pedido
            </Link>
            <Link
              href={tableCode ? `/pedido/novo?mesa=${tableCode}` : '/pedido/novo'}
              className="flex-1 rounded-lg bg-fuchsia-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-fuchsia-500"
            >
              Finalizar pedido
            </Link>
          </div>
        </div>
      )}

      {wizardProduct ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 md:items-center">
          <div className="flex w-full max-w-2xl flex-col rounded-2xl border border-acai-600 bg-acai-900 p-5 shadow-2xl max-h-[92vh]">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-fuchsia-300">
                {wizardProduct.selectionTitle?.trim() || 'PERSONALIZE SEU PRODUTO'}
              </p>
              <h3 className="mt-1 text-lg font-bold text-fuchsia-100">{wizardProduct.name}</h3>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {wizardProduct.customizations.map((customization) => {
                const selectedOptionsCount =
                  selectedChoicesByCustomization[customization.id]?.length ?? 0
                const minSelect = Math.max(
                  0,
                  customization.minSelect ?? (customization.required ? 1 : 0)
                )

                return (
                  <section
                    key={customization.id}
                    className="border-acai-700/60 border-t pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-fuchsia-100">
                        {customization.label}
                      </p>
                      <p className="mt-1 text-xs text-acai-400">
                        {minSelect > 0
                          ? `Obrigatório (${minSelect} mínimo)`
                          : 'Opcional'}
                        {typeof customization.maxSelect === 'number' && customization.maxSelect > 0
                          ? ` • máximo ${customization.maxSelect}`
                          : ''}{' '}
                        • {selectedOptionsCount} selecionado(s)
                      </p>
                    </div>

                    <div className="space-y-2">
                      {customization.options.map((option) => {
                        const selected = (
                          selectedChoicesByCustomization[customization.id] ?? []
                        ).includes(option.id)
                        const effectivePrice =
                          customization.affectsPrice === false
                            ? 0
                            : option.priceModifier

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleChoice(customization.id, option.id)}
                            className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                              selected
                                ? 'border-fuchsia-400 bg-fuchsia-950/40 text-fuchsia-100'
                                : 'border-acai-600 bg-acai-800 text-acai-100 hover:bg-acai-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm">{option.optionProduct?.name ?? option.name}</span>
                              <span className="text-xs text-fuchsia-300">
                                {effectivePrice > 0
                                  ? `+ R$ ${effectivePrice.toFixed(2)}`
                                  : 'Sem custo'}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>

            {wizardError ? <p className="mt-3 text-sm text-amber-400">{wizardError}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeWizard}
                className="flex-1 rounded-lg border border-acai-500 px-4 py-2 text-sm font-medium text-acai-100 hover:bg-acai-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addWizardItemToCart}
                className="flex-1 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
