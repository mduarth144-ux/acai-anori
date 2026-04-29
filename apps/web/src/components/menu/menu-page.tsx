'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemedSelect } from '../ui/themed-select'
import { useCartStore } from '../../store/cart-store'

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  category: { id: string; name: string; slug: string }
  customizations: ProductCustomization[]
}

type Category = { id: string; name: string; slug: string }
type ProductCustomization = {
  id: string
  label: string
  required: boolean
  minSelect?: number
  affectsPrice?: boolean
  options: Array<{ id: string; name: string; priceModifier: number }>
}

type Props = {
  categories: Category[]
  products: Product[]
  tableCode?: string
}

const PRODUCTS_BATCH_SIZE = 8

export function MenuPage({ categories, products, tableCode }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_BATCH_SIZE)
  const [wizardProduct, setWizardProduct] = useState<Product | null>(null)
  const [selectedChoicesByCustomization, setSelectedChoicesByCustomization] = useState<Record<string, string[]>>({})
  const [wizardError, setWizardError] = useState<string | null>(null)
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

  const filtered = useMemo(() => {
    const frozenPriority = ['tradicional', 'especial', 'casadinha', 'mix', 'litro']

    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

    const ranked = products
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
  }, [activeCategory, products, query])

  const bestSellers = useMemo(
    () =>
      bestSellerNames
        .map((name) => products.find((product) => product.name === name))
        .filter((product): product is Product => Boolean(product)),
    [products]
  )
  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  )
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
    setSelectedChoicesByCustomization((prev) => {
      const selected = new Set(prev[customizationId] ?? [])
      if (selected.has(optionId)) {
        selected.delete(optionId)
      } else {
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
      const selectedCount =
        selectedChoicesByCustomization[customization.id]?.length ?? 0

      if (selectedCount < minSelect) {
        setWizardError(
          `No grupo "${customization.label}", selecione pelo menos ${minSelect} item(ns).`
        )
        return
      }
    }

    const allChoices = wizardProduct.customizations.flatMap((customization) => {
      const selectedIds = new Set(selectedChoicesByCustomization[customization.id] ?? [])
      return customization.options
        .filter((option) => selectedIds.has(option.id))
        .map((option) => ({
          name: option.name,
          priceModifier: customization.affectsPrice === false ? 0 : option.priceModifier,
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

      {bestSellers.length > 0 ? (
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {visibleProducts.map((product) => (
          <article key={product.id} className="flex h-full flex-col rounded-2xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg shadow-black/20 ring-1 ring-acai-700/50">
            <div className="mb-3 h-40 overflow-hidden rounded-xl bg-acai-900">
              {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={600} height={300} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-acai-400">Sem imagem</div>}
            </div>
            <h2 className="text-xl font-semibold text-fuchsia-100">{product.name}</h2>
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
                ESCOLHA UM ACOMPANHAMENTO
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
                          : 'Opcional'}{' '}
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
                              <span className="text-sm">{option.name}</span>
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
