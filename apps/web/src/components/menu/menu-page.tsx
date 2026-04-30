'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  ClipboardList,
  Home,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Tag,
  Truck,
  User,
  X,
} from 'lucide-react'
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
  const [selectedChoicesByCustomization, setSelectedChoicesByCustomization] = useState<
    Record<string, Record<string, number>>
  >({})
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [wizardQuantity, setWizardQuantity] = useState(1)
  const [wizardNotes, setWizardNotes] = useState('')
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
  const featuredProducts = useMemo(() => {
    const base = bestSellers.slice(0, 3)
    const pickedIds = new Set(base.map((product) => product.id))
    const candidates = storefrontProducts.filter((product) => !pickedIds.has(product.id))
    // SSR-safe: keep deterministic order to avoid hydration mismatch.
    const extras = candidates.slice(0, 3)
    return [...base, ...extras]
  }, [bestSellers, storefrontProducts])
  const productImageById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product.imageUrl]))
  }, [products])
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
    setWizardQuantity(1)
    setWizardNotes('')
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
    setWizardQuantity(1)
    setWizardNotes('')
  }

  function updateOptionQuantity(customizationId: string, optionId: string, delta: number) {
    if (!wizardProduct) return
    const customization = wizardProduct.customizations.find((item) => item.id === customizationId)
    if (!customization) return

    setSelectedChoicesByCustomization((prev) => {
      const currentGroup = { ...(prev[customizationId] ?? {}) }
      const currentCount = Object.values(currentGroup).reduce((sum, value) => sum + value, 0)
      const maxSelect = customization.maxSelect ?? null

      if (delta > 0 && typeof maxSelect === 'number' && maxSelect > 0 && currentCount >= maxSelect) {
          setWizardError(`No grupo "${customization.label}", selecione no máximo ${maxSelect} item(ns).`)
        return prev
      }

      const nextQty = Math.max(0, (currentGroup[optionId] ?? 0) + delta)
      if (nextQty === 0) {
        delete currentGroup[optionId]
      } else {
        currentGroup[optionId] = nextQty
      }

      return {
        ...prev,
        [customizationId]: currentGroup,
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
        Object.values(selectedChoicesByCustomization[customization.id] ?? {}).reduce(
          (sum, value) => sum + value,
          0
        )

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
      const selectedByOption = selectedChoicesByCustomization[customization.id] ?? {}
      let freeSlotsRemaining =
        customization.affectsPrice === false
          ? Number.MAX_SAFE_INTEGER
          : Math.max(0, customization.freeQuantity ?? 0)

      return customization.options.flatMap((option) => {
        const quantity = selectedByOption[option.id] ?? 0
        if (quantity <= 0) return []

        return Array.from({ length: quantity }, () => ({
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
    })

    addItem({
      productId: wizardProduct.id,
      name: wizardProduct.name,
      quantity: wizardQuantity,
      unitPrice: wizardProduct.price,
      imageUrl: wizardProduct.imageUrl,
      description: wizardProduct.description,
      choices: allChoices,
      notes: wizardNotes.trim() || undefined,
    })
    closeWizard()
  }

  const wizardChoicesSubtotal = useMemo(() => {
    if (!wizardProduct) return 0
    return wizardProduct.customizations.reduce((customizationTotal, customization) => {
      const selectedByOption = selectedChoicesByCustomization[customization.id] ?? {}
      let freeSlotsRemaining =
        customization.affectsPrice === false
          ? Number.MAX_SAFE_INTEGER
          : Math.max(0, customization.freeQuantity ?? 0)

      const optionTotal = customization.options.reduce((sum, option) => {
        const qty = selectedByOption[option.id] ?? 0
        if (qty <= 0) return sum
        if (customization.affectsPrice === false) return sum

        const freeItems = Math.min(freeSlotsRemaining, qty)
        freeSlotsRemaining -= freeItems
        return sum + (qty - freeItems) * option.priceModifier
      }, 0)

      return customizationTotal + optionTotal
    }, 0)
  }, [wizardProduct, selectedChoicesByCustomization])

  const wizardTotalPrice =
    wizardProduct ? (wizardProduct.price + wizardChoicesSubtotal) * wizardQuantity : 0

  const timelineIndex = (() => {
    if (!activeOrder) return -1
    if (activeOrder.status === 'CONFIRMED') return 1
    return Math.max(TIMELINE_STEPS.findIndex((step) => step.id === activeOrder.status), 0)
  })()

  return (
    <main className="menu-page min-h-screen bg-[#05020b]">
      <header className="menu-page-hero relative mb-6">
        <div className="menu-page-hero-banner relative h-40 w-full overflow-hidden bg-[#4f1b67] sm:h-48 lg:h-56">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(203,124,245,0.42),transparent_36%),radial-gradient(circle_at_78%_20%,rgba(186,106,237,0.3),transparent_34%),radial-gradient(circle_at_55%_70%,rgba(148,98,232,0.34),transparent_44%),linear-gradient(180deg,#6b2a8f_0%,#582178_52%,#3f1458_100%)]" />
          {[...Array(16)].map((_, index) => (
            <span
              key={`hero-particle-${index}`}
              className="absolute rounded-full bg-fuchsia-100/65 blur-[1px] animate-[heroNebula_8s_ease-in-out_infinite]"
              style={{
                width: `${3 + (index % 3) * 3}px`,
                height: `${3 + (index % 3) * 3}px`,
                left: `${6 + ((index * 19) % 88)}%`,
                top: `${8 + ((index * 23) % 72)}%`,
                animationDelay: `${index * 0.28}s`,
                opacity: 0.2 + (index % 4) * 0.12,
              }}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(to_top,rgba(255,255,255,0.12),transparent)]" />
        </div>
        <div className="menu-page-hero-strip pointer-events-none absolute inset-x-0 bottom-0 h-11 bg-[#ececef]" />
        <div className="absolute bottom-11 left-1/2 z-20 -translate-x-1/2 translate-y-1/2">
          <div className="h-24 w-24 rounded-full bg-white p-1 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.8)] ring-2 ring-white sm:h-28 sm:w-28">
            <div className="h-full w-full overflow-hidden rounded-full bg-[#4a1d74]">
              <Image
                src="/brand/logo.png"
                alt="Logo Açaí Legal"
                width={112}
                height={112}
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4 pb-36 pt-11">

      {activeOrder ? (
        <section className="order-progress-card border-acai-600 bg-acai-800/90 mb-6 rounded-2xl border p-4 shadow-lg ring-1 ring-fuchsia-900/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="order-progress-title text-fuchsia-200 text-sm font-semibold">Pedido em andamento</p>
              <p className="order-progress-subtitle text-acai-300 mt-1 text-xs">
                Acompanhe seu pedido #{activeOrder.id} - {orderStatusLabel(activeOrder.status)}
              </p>

              <ol className="order-progress-timeline mt-4">
                {TIMELINE_STEPS.map((step, index) => {
                  const done = index <= timelineIndex
                  const active = index === timelineIndex
                  return (
                    <li key={step.id} className="order-progress-step">
                      <div className="order-progress-dot-wrap">
                        <span
                          className={[
                            'order-progress-dot inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                            done ? 'is-done' : 'is-pending',
                            active ? 'is-active' : '',
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
                            'order-progress-connector',
                            index < timelineIndex ? 'is-done' : 'is-pending',
                          ].join(' ')}
                        />
                      ) : null}
                      <span
                        className={[
                          'order-progress-label',
                          done ? 'is-done' : 'is-pending',
                          active ? 'is-active' : '',
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

      <div className="mb-6 grid gap-3 sm:grid-cols-[minmax(220px,280px)_1fr]">
        <ThemedSelect
          id="category-filter"
          value={activeCategory}
          onChange={(nextValue) => setActiveCategory(nextValue)}
          className="w-full"
          options={[
            { value: 'all', label: 'Lista de categorias' },
            ...categories.map((category) => ({
              value: category.slug,
              label: category.name,
            })),
          ]}
        />
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-500 shadow-sm transition hover:border-zinc-400 focus-within:border-fuchsia-500 focus-within:ring-2 focus-within:ring-fuchsia-500/30">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busque por um produto"
            className="h-full w-full border-0 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
          />
        </label>
      </div>

      {shouldShowBestSellers && featuredProducts.length > 0 ? (
        <section className="mb-6">
          <h2 className="menu-section-heading mb-3 text-xl font-bold text-fuchsia-100">
            Os mais pedidos
          </h2>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {featuredProducts.map((product) => (
              <article
                key={`best-${product.id}`}
                className="best-seller-card flex min-w-[230px] snap-start flex-col rounded-xl border border-acai-600 bg-acai-900/60 p-2 sm:min-w-[250px]"
              >
                <div className="mb-2 h-36 overflow-hidden rounded-lg bg-acai-900">
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
                <h3 className="best-seller-title line-clamp-2 text-sm font-semibold text-fuchsia-100">
                  {product.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-acai-300">
                  {product.description ?? 'Delicioso e cremoso, feito na hora para você.'}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="best-seller-price text-sm font-bold text-fuchsia-300">
                    R$ {product.price.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startWizard(product)}
                    className="best-seller-button rounded-md bg-fuchsia-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-fuchsia-500"
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {categoryProducts.map((product) => (
                <article
                  key={product.id}
                  className="product-card flex h-full items-stretch gap-3 rounded-2xl border border-acai-600 bg-acai-800/90 p-3 shadow-xl shadow-black/30 ring-1 ring-acai-700/50"
                >
                  <div className="order-2 w-28 shrink-0 overflow-hidden rounded-xl bg-acai-900 sm:w-32">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={360}
                        height={360}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-24 items-center justify-center text-xs text-acai-400">
                        Sem imagem
                      </div>
                    )}
                  </div>
                  <div className="order-1 flex min-w-0 flex-1 flex-col">
                    <h3 className="product-card-title line-clamp-2 text-base font-semibold text-fuchsia-100 sm:text-lg">
                      {product.name}
                    </h3>
                    <p className="product-card-description mt-1 line-clamp-3 text-xs text-acai-300 sm:text-sm">
                      {product.description ?? 'Açaí artesanal com ingredientes selecionados.'}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span className="product-card-price font-bold text-fuchsia-300">
                        R$ {product.price.toFixed(2)}
                      </span>
                      <button
                        onClick={() => startWizard(product)}
                        className="product-card-button rounded-lg bg-fuchsia-600 px-3 py-2 text-sm text-white shadow hover:bg-fuchsia-500"
                      >
                        Adicionar
                      </button>
                    </div>
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

      {itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-40 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-fuchsia-500 px-3 py-2 text-white shadow-2xl shadow-black/40 sm:px-4">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-2 py-2 text-xs font-semibold sm:px-3 sm:text-sm">
              <ShoppingBag className="h-4 w-4" />
              <span>{itemCount}</span>
            </div>
            <Link
              href={tableCode ? `/carrinho?mesa=${tableCode}` : '/carrinho'}
              aria-label="Abrir sacola"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-white/10 text-lg font-semibold text-white transition hover:bg-white/20"
            >
              +
            </Link>
            <span className="text-right text-xs font-semibold sm:text-sm">R$ {total().toFixed(2)}</span>
          </div>
        </div>
      ) : null}

      {wizardProduct ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 md:items-center md:p-4">
          <div className="wizard-modal flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f2f2f4] text-zinc-800 md:h-auto md:max-h-[92vh] md:max-w-5xl md:flex-row md:rounded-2xl md:border md:border-zinc-200 md:bg-white md:shadow-2xl">
            <div className="hidden bg-zinc-100 md:block md:w-[48%] md:p-6">
              <div className="h-full overflow-hidden rounded-2xl bg-zinc-200">
                {wizardProduct.imageUrl ? (
                  <Image
                    src={wizardProduct.imageUrl}
                    alt={wizardProduct.name}
                    width={640}
                    height={640}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-64 items-center justify-center text-sm text-zinc-500">
                    Sem imagem
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 md:bg-white md:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="wizard-modal-title text-2xl font-bold text-zinc-700">{wizardProduct.name}</h3>
                    {wizardProduct.description ? (
                      <p className="mt-1 text-sm text-zinc-500">{wizardProduct.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={closeWizard}
                    className="rounded-full bg-zinc-200 p-2 text-zinc-500 hover:bg-zinc-300"
                    aria-label="Fechar customização"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
              {wizardProduct.customizations.map((customization) => {
                const selectedOptionsCount =
                  Object.values(selectedChoicesByCustomization[customization.id] ?? {}).reduce(
                    (sum, value) => sum + value,
                    0
                  )
                const minSelect = Math.max(
                  0,
                  customization.minSelect ?? (customization.required ? 1 : 0)
                )

                return (
                  <section
                    key={customization.id}
                    className="wizard-modal-group border-t border-zinc-200 first:border-t-0"
                  >
                    <div className="bg-zinc-100 px-4 py-3">
                      <p className="wizard-modal-group-title text-[1.7rem] font-semibold text-zinc-700">
                        {customization.label}
                      </p>
                      <p className="wizard-modal-group-hint mt-1 text-sm text-zinc-500">
                        {typeof customization.maxSelect === 'number' && customization.maxSelect > 0
                          ? `Escolha até ${customization.maxSelect} ${customization.maxSelect === 1 ? 'opção' : 'opções'}`
                          : minSelect > 0
                            ? `Escolha no mínimo ${minSelect} ${minSelect === 1 ? 'opção' : 'opções'}`
                            : 'Opcional'}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-zinc-600">
                        {selectedOptionsCount}/{customization.maxSelect ?? (selectedOptionsCount || 1)}{' '}
                        {minSelect > 0 ? 'OBRIGATÓRIO' : 'OPCIONAL'}
                      </p>
                    </div>

                    <div>
                      {customization.options.map((option) => {
                        const selectedQty =
                          selectedChoicesByCustomization[customization.id]?.[option.id] ?? 0
                        const effectivePrice =
                          customization.affectsPrice === false
                            ? 0
                            : option.priceModifier
                        const optionImageUrl =
                          (option.optionProduct?.id
                            ? productImageById.get(option.optionProduct.id)
                            : null) ?? null

                        return (
                          <div
                            key={option.id}
                            className="wizard-modal-option flex items-center gap-3 border-b border-zinc-200 px-4 py-3 text-left"
                          >
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
                              {optionImageUrl ? (
                                <Image
                                  src={optionImageUrl}
                                  alt={option.optionProduct?.name ?? option.name}
                                  width={96}
                                  height={96}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-lg text-zinc-700">{option.optionProduct?.name ?? option.name}</p>
                              <span className="wizard-modal-option-price text-sm font-semibold text-zinc-600">
                                {effectivePrice > 0
                                  ? `+ R$ ${effectivePrice.toFixed(2)}`
                                  : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {selectedQty > 0 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateOptionQuantity(customization.id, option.id, -1)}
                                    className="text-fuchsia-500 hover:text-fuchsia-600"
                                    aria-label={`Diminuir ${option.optionProduct?.name ?? option.name}`}
                                  >
                                    <Minus className="h-5 w-5" />
                                  </button>
                                  <span className="w-4 text-center text-lg text-zinc-700">{selectedQty}</span>
                                </>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => updateOptionQuantity(customization.id, option.id, 1)}
                                className="text-fuchsia-500 hover:text-fuchsia-600"
                                aria-label={`Adicionar ${option.optionProduct?.name ?? option.name}`}
                              >
                                <Plus className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
              </div>

            {wizardError ? <p className="wizard-modal-error mt-3 text-sm text-amber-400">{wizardError}</p> : null}

              <div className="border-t border-zinc-200 px-4 py-3">
                <label className="mb-3 block text-base text-zinc-500">
                  Alguma observação?
                  <span className="ml-2 text-xs">{wizardNotes.length} / 140</span>
                </label>
                <textarea
                  value={wizardNotes}
                  onChange={(e) => setWizardNotes(e.target.value.slice(0, 140))}
                  className="h-20 w-full resize-none rounded-md border border-zinc-300 p-3 text-sm outline-none focus:border-fuchsia-500"
                />
              </div>

              <div className="sticky bottom-0 border-t border-zinc-200 bg-white px-4 py-3">
                {wizardError ? (
                  <p className="wizard-modal-error mb-2 text-sm font-medium text-rose-500">{wizardError}</p>
                ) : null}
                <div className="flex gap-2">
                  <div className="flex items-center gap-4 rounded-lg bg-zinc-100 px-4">
                    <button
                      type="button"
                      onClick={() => setWizardQuantity((current) => Math.max(1, current - 1))}
                      className="text-zinc-500 hover:text-zinc-700"
                      aria-label="Diminuir quantidade do produto"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="min-w-4 text-lg text-zinc-700">{wizardQuantity}</span>
                    <button
                      type="button"
                      onClick={() => setWizardQuantity((current) => current + 1)}
                      className="text-zinc-500 hover:text-zinc-700"
                      aria-label="Aumentar quantidade do produto"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={addWizardItemToCart}
                    className="wizard-modal-submit flex-1 rounded-lg bg-fuchsia-500 px-4 py-2 text-lg font-semibold text-white hover:bg-fuchsia-600"
                  >
                    <span className="mr-2">Adicionar</span>
                    <span>R$ {wizardTotalPrice.toFixed(2)}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <style jsx>{`
        @keyframes heroNebula {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, -10px, 0) scale(1.2);
          }
        }
      `}</style>
      </div>
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-[#ececef]">
        <nav className="mx-auto grid h-16 w-full max-w-3xl grid-cols-4 items-center">
          <Link
            href="/"
            className="flex flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-fuchsia-600"
          >
            <Home className="h-5 w-5" />
            <span>Início</span>
          </Link>
          <Link
            href="/promocoes"
            className="flex flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-zinc-500 transition hover:text-fuchsia-600"
          >
            <Tag className="h-5 w-5" />
            <span>Promoções</span>
          </Link>
          <Link
            href={tableCode ? `/pedido/novo?mesa=${tableCode}` : '/pedido/novo'}
            className="flex flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-zinc-500 transition hover:text-fuchsia-600"
          >
            <ClipboardList className="h-5 w-5" />
            <span>Pedidos</span>
          </Link>
          <Link
            href="/perfil"
            className="flex flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-zinc-500 transition hover:text-fuchsia-600"
          >
            <User className="h-5 w-5" />
            <span>Perfil</span>
          </Link>
        </nav>
      </footer>
    </main>
  )
}
