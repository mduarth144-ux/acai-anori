'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
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
  options: Array<{ id: string; name: string; priceModifier: number }>
}

type Props = {
  categories: Category[]
  products: Product[]
  tableCode?: string
}

export function MenuPage({ categories, products, tableCode }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [wizardProduct, setWizardProduct] = useState<Product | null>(null)
  const [wizardStep, setWizardStep] = useState(0)
  const [selectedChoicesByCustomization, setSelectedChoicesByCustomization] = useState<Record<string, string[]>>({})
  const [wizardError, setWizardError] = useState<string | null>(null)
  const addItem = useCartStore((state) => state.addItem)
  const items = useCartStore((state) => state.items)
  const total = useCartStore((state) => state.total)
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0)

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

  const currentCustomization = wizardProduct?.customizations[wizardStep]

  const selectedOptionsForCurrentStep = useMemo(() => {
    if (!currentCustomization) return []
    const selectedIds = new Set(selectedChoicesByCustomization[currentCustomization.id] ?? [])
    return currentCustomization.options.filter((option) => selectedIds.has(option.id))
  }, [currentCustomization, selectedChoicesByCustomization])

  function closeWizard() {
    setWizardProduct(null)
    setWizardStep(0)
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
    setWizardStep(0)
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

  function validateCurrentStep() {
    if (!currentCustomization) return true
    if (!currentCustomization.required) return true
    const selected = selectedChoicesByCustomization[currentCustomization.id] ?? []
    if (selected.length > 0) return true
    setWizardError('Este passo é obrigatório. Selecione pelo menos uma opção para continuar.')
    return false
  }

  function nextWizardStep() {
    if (!wizardProduct) return
    if (!validateCurrentStep()) return
    if (wizardStep < wizardProduct.customizations.length - 1) {
      setWizardStep((s) => s + 1)
      setWizardError(null)
      return
    }

    const allChoices = wizardProduct.customizations.flatMap((customization) => {
      const selectedIds = new Set(selectedChoicesByCustomization[customization.id] ?? [])
      return customization.options
        .filter((option) => selectedIds.has(option.id))
        .map((option) => ({ name: option.name, priceModifier: option.priceModifier }))
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
          <div>
            <h1 className="text-3xl font-bold">Anori Acaí Frozen</h1>
            <p className="mt-1 text-sm text-fuchsia-200/90">Açaí e Açaí Frozen para consumir na loja ou pedir online.</p>
          </div>
          <Image src="/brand/logo.png" alt="Logo Anori Açaí Frozen" width={120} height={120} className="rounded-xl bg-acai-950/60 p-2 ring-1 ring-white/15" />
        </div>
        {tableCode ? <p className="mt-3 text-sm text-acai-100">Pedido em mesa: <b>{tableCode}</b></p> : null}
      </header>

      <div className="mb-4">
        <label htmlFor="category-filter" className="mb-2 block text-sm font-medium text-fuchsia-200/90">
          Categoria
        </label>
        <select
          id="category-filter"
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value)}
          className="w-full appearance-none rounded-xl border border-acai-600 bg-acai-800 py-3 pl-3 pr-10 text-fuchsia-100 shadow-sm ring-1 ring-acai-700/50 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23e879f9'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.25rem' }}
        >
          <option value="all">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" className="mb-6 w-full rounded-xl p-3" />

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((product) => (
          <article key={product.id} className="rounded-2xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg shadow-black/20 ring-1 ring-acai-700/50">
            <div className="mb-3 h-40 overflow-hidden rounded-xl bg-acai-900">
              {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={600} height={300} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-acai-400">Sem imagem</div>}
            </div>
            <h2 className="text-xl font-semibold text-fuchsia-100">{product.name}</h2>
            <p className="my-2 text-sm text-acai-300">{product.description ?? 'Açaí artesanal com ingredientes selecionados.'}</p>
            <div className="flex items-center justify-between">
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

      {wizardProduct && currentCustomization ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 md:items-center">
          <div className="w-full max-w-xl rounded-2xl border border-acai-600 bg-acai-900 p-5 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-fuchsia-300">
                ESCOLHA UM ACOMPANHAMENTO
              </p>
              <h3 className="mt-1 text-lg font-bold text-fuchsia-100">{wizardProduct.name}</h3>
              <p className="mt-1 text-sm text-acai-300">{currentCustomization.label}</p>
              <p className="mt-1 text-xs text-acai-400">
                {currentCustomization.required ? 'Obrigatório' : 'Opcional'} • {selectedOptionsForCurrentStep.length} selecionado(s)
              </p>
            </div>

            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {currentCustomization.options.map((option) => {
                const selected = (selectedChoicesByCustomization[currentCustomization.id] ?? []).includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleChoice(currentCustomization.id, option.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      selected
                        ? 'border-fuchsia-400 bg-fuchsia-950/40 text-fuchsia-100'
                        : 'border-acai-600 bg-acai-800 text-acai-100 hover:bg-acai-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm">{option.name}</span>
                      <span className="text-xs text-fuchsia-300">
                        {option.priceModifier > 0 ? `+ R$ ${option.priceModifier.toFixed(2)}` : 'Sem custo'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {wizardError ? <p className="mt-3 text-sm text-amber-400">{wizardError}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (wizardStep === 0) {
                    closeWizard()
                    return
                  }
                  setWizardStep((s) => Math.max(0, s - 1))
                  setWizardError(null)
                }}
                className="flex-1 rounded-lg border border-acai-500 px-4 py-2 text-sm font-medium text-acai-100 hover:bg-acai-800"
              >
                {wizardStep === 0 ? 'Cancelar' : 'Voltar'}
              </button>
              <button
                type="button"
                onClick={nextWizardStep}
                className="flex-1 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500"
              >
                {wizardStep === wizardProduct.customizations.length - 1 ? 'Adicionar ao pedido' : 'Próximo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
