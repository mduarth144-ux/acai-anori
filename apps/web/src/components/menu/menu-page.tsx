'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, ChefHat, Clock3, Plus, Search, Truck } from 'lucide-react'
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
const MAX_OPTIONS_PER_CUSTOMIZATION_GROUP = 6
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
  const featuredProducts = useMemo(() => {
    const base = bestSellers.slice(0, 3)
    const pickedIds = new Set(base.map((product) => product.id))
    const candidates = storefrontProducts.filter((product) => !pickedIds.has(product.id))
    const shuffled = [...candidates].sort(() => Math.random() - 0.5)
    const extras = shuffled.slice(0, 3)
    return [...base, ...extras]
  }, [bestSellers, storefrontProducts])
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
      const limitedOptions = customization.options.slice(0, MAX_OPTIONS_PER_CUSTOMIZATION_GROUP)
      const selectedIds = new Set(selectedChoicesByCustomization[customization.id] ?? [])
      let freeSlotsRemaining =
        customization.affectsPrice === false ? Number.MAX_SAFE_INTEGER : Math.max(0, customization.freeQuantity ?? 0)
      return limitedOptions
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
    <main>
      <header className="relative mb-6">
        <div className="relative h-40 w-full overflow-hidden bg-[#4f1b67] sm:h-48 lg:h-56">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-11 bg-[#ececef]" />
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
      <div className="mx-auto max-w-6xl p-4 pt-11">

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
          <div className="wizard-modal flex w-full max-w-2xl flex-col rounded-2xl border border-acai-600 bg-acai-900 p-5 shadow-2xl max-h-[92vh]">
            <div className="mb-4">
              <p className="wizard-modal-kicker text-xs uppercase tracking-wide text-fuchsia-300">
                {wizardProduct.selectionTitle?.trim() || 'PERSONALIZE SEU PRODUTO'}
              </p>
              <h3 className="wizard-modal-title mt-1 text-lg font-bold text-fuchsia-100">{wizardProduct.name}</h3>
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
                    className="wizard-modal-group border-acai-700/60 border-t pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="mb-2">
                      <p className="wizard-modal-group-title text-sm font-semibold text-fuchsia-100">
                        {customization.label}
                      </p>
                      <p className="wizard-modal-group-hint mt-1 text-xs text-acai-400">
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
                      {customization.options
                        .slice(0, MAX_OPTIONS_PER_CUSTOMIZATION_GROUP)
                        .map((option) => {
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
                            className={`wizard-modal-option w-full rounded-xl border px-3 py-2 text-left transition ${
                              selected
                                ? 'border-fuchsia-400 bg-fuchsia-950/40 text-fuchsia-100'
                                : 'border-acai-600 bg-acai-800 text-acai-100 hover:bg-acai-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm">{option.optionProduct?.name ?? option.name}</span>
                              <span className="wizard-modal-option-price text-xs text-fuchsia-300">
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

            {wizardError ? <p className="wizard-modal-error mt-3 text-sm text-amber-400">{wizardError}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeWizard}
                className="wizard-modal-cancel flex-1 rounded-lg border border-acai-500 px-4 py-2 text-sm font-medium text-acai-100 hover:bg-acai-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addWizardItemToCart}
                className="wizard-modal-submit flex-1 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500"
              >
                Adicionar
              </button>
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
    </main>
  )
}
