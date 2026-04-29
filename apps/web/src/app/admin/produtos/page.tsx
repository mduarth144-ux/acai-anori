'use client'

import Image from 'next/image'
import { Edit3, Plus, Search, Trash2 } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ThemedSelect } from '../../../components/ui/themed-select'

type Category = { id: string; name: string }
type RelatedProduct = {
  id: string
  name: string
  price: number
  category: { id: string; name: string }
}

type ProductRelation = {
  id: string
  isPaid: boolean
  child: RelatedProduct
}

type Product = {
  id: string
  name: string
  price: number
  description: string | null
  imageUrl?: string | null
  available: boolean
  category: { id: string; name: string }
  parentRelations: ProductRelation[]
}

type PendingRelation = {
  childProductId: string
  isPaid: boolean
}

const PRODUCTS_BATCH_SIZE = 12

export default function AdminProdutosPage() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [available, setAvailable] = useState(true)
  const [filterName, setFilterName] = useState('')
  const [filterDescription, setFilterDescription] = useState('')
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'active' | 'inactive'>('all')
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_BATCH_SIZE)
  const [relatedItems, setRelatedItems] = useState<PendingRelation[]>([])
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [categoriesResp, productsResp] = await Promise.all([
        fetch('/api/categories').then((res) => res.json()),
        fetch('/api/products?admin=1').then((res) => res.json()),
      ])
      setCategories(categoriesResp)
      setProducts(productsResp)
      if (categoriesResp.length > 0) {
        setCategoryId((current) => current || categoriesResp[0].id)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setName('')
    setDescription('')
    setPrice('')
    setAvailable(true)
    setRelatedItems([])
    setEditingProductId(null)
    setShowForm(false)
  }

  function startEdit(product: Product) {
    setShowForm(true)
    setEditingProductId(product.id)
    setName(product.name)
    setDescription(product.description ?? '')
    setPrice(String(Number(product.price)))
    setCategoryId(product.category.id)
    setAvailable(product.available)
    setRelatedItems(
      product.parentRelations.map((relation) => ({
        childProductId: relation.child.id,
        isPaid: relation.isPaid,
      }))
    )
    setFeedback(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFeedback(null)
    setIsSaving(true)
    const payload = {
      name,
      description: description || null,
      price: Number(price),
      categoryId,
      available,
      relatedItems: relatedItems.map((item, index) => ({
        childProductId: item.childProductId,
        isPaid: item.isPaid,
        order: index,
      })),
    }
    const response = await fetch(
      editingProductId ? `/api/products?id=${editingProductId}` : '/api/products',
      {
      method: editingProductId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      }
    )
    if (!response.ok) {
      setFeedback('Não foi possível salvar o produto.')
      setIsSaving(false)
      return
    }
    resetForm()
    setFeedback(editingProductId ? 'Produto atualizado com sucesso.' : 'Produto salvo com sucesso.')
    await load()
    setIsSaving(false)
  }

  function addRelatedItem() {
    setRelatedItems((prev) => [...prev, { childProductId: '', isPaid: false }])
  }

  function removeRelatedItem(index: number) {
    setRelatedItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  function updateRelatedItem(index: number, patch: Partial<PendingRelation>) {
    setRelatedItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    )
  }

  async function deleteProduct(product: Product) {
    const confirmDelete = window.confirm(`Excluir o produto "${product.name}"?`)
    if (!confirmDelete) return

    setIsDeletingId(product.id)
    setFeedback(null)
    const response = await fetch(`/api/products?id=${product.id}`, { method: 'DELETE' })
    if (!response.ok) {
      setFeedback('Não foi possível excluir o produto.')
      setIsDeletingId(null)
      return
    }
    if (editingProductId === product.id) resetForm()
    setFeedback('Produto excluído com sucesso.')
    await load()
    setIsDeletingId(null)
  }

  const possibleChildren = products
  const filteredProducts = useMemo(() => {
    const normalizedName = filterName.trim().toLowerCase()
    const normalizedDescription = filterDescription.trim().toLowerCase()
    return products.filter((product) => {
      const nameMatch =
        normalizedName.length === 0 ||
        product.name.toLowerCase().includes(normalizedName)
      const descriptionMatch =
        normalizedDescription.length === 0 ||
        (product.description ?? '').toLowerCase().includes(normalizedDescription)
      const availabilityMatch =
        filterAvailability === 'all' ||
        (filterAvailability === 'active' ? product.available : !product.available)
      return nameMatch && descriptionMatch && availabilityMatch
    })
  }, [products, filterName, filterDescription, filterAvailability])
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  )
  const hasMoreProducts = visibleCount < filteredProducts.length

  useEffect(() => {
    setVisibleCount(PRODUCTS_BATCH_SIZE)
  }, [filterName, filterDescription, filterAvailability, products.length])

  useEffect(() => {
    const observerTarget = loadMoreRef.current
    if (!observerTarget || !hasMoreProducts) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisibleCount((current) =>
          Math.min(current + PRODUCTS_BATCH_SIZE, filteredProducts.length)
        )
      },
      { rootMargin: '240px 0px' }
    )

    observer.observe(observerTarget)
    return () => observer.disconnect()
  }, [filteredProducts.length, hasMoreProducts])

  return (
    <main className="w-full">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">Produtos</h1>

      <div className="mb-4 grid gap-3 rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid flex-1 gap-2 md:grid-cols-3 md:items-end">
          <label className="flex flex-col text-xs text-acai-200">
            Nome
            <div className="border-acai-600 bg-acai-950/80 hover:border-fuchsia-600 focus-within:border-fuchsia-500 focus-within:ring-fuchsia-500/50 mt-1 flex min-h-11 items-center gap-2 rounded-xl border px-3 shadow-sm transition focus-within:ring-2">
              <Search className="h-4 w-4 text-acai-400" />
              <input
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Filtrar por nome"
                className="h-full w-full border-0 bg-transparent p-0 text-sm text-acai-50 shadow-none outline-none ring-0 placeholder:text-acai-400 focus:border-0 focus:outline-none focus:ring-0"
              />
            </div>
          </label>
          <label className="flex flex-col text-xs text-acai-200">
            Descrição
            <input
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              placeholder="Filtrar por descrição"
              className="border-acai-600 bg-acai-950/80 text-acai-50 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/50 hover:border-fuchsia-600 mt-1 min-h-11 w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm transition placeholder:text-acai-400 focus:outline-none focus-visible:ring-2"
            />
          </label>
          <label className="flex flex-col text-xs text-acai-200">
            Ativo para venda
            <ThemedSelect
              value={filterAvailability}
              onChange={(nextValue) =>
                setFilterAvailability(nextValue as 'all' | 'active' | 'inactive')
              }
              className="mt-1 w-full"
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Ativos' },
                { value: 'inactive', label: 'Inativos' },
              ]}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 self-end sm:flex-row sm:items-end">
          <button
            type="button"
            onClick={() => {
              setShowForm(true)
              setEditingProductId(null)
              setFeedback(null)
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-4 text-sm font-medium text-white hover:bg-fuchsia-500"
          >
            <Plus className="h-4 w-4" />
            Cadastrar
          </button>
        </div>
      </div>

      {showForm ? (
        <form onSubmit={onSubmit} className="mb-4 space-y-3 rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-fuchsia-200">
              {editingProductId ? 'Editando produto' : 'Cadastro de produto'}
            </p>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-acai-500 px-3 py-1 text-xs text-acai-100 hover:bg-acai-700/60"
            >
              Cancelar
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg p-2" placeholder="Nome" />
            <input required value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-lg p-2" placeholder="Preço" />
            <ThemedSelect
              value={categoryId}
              onChange={(nextValue) => setCategoryId(nextValue)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              className="w-full"
            />
            <label className="flex items-center gap-2 rounded-lg border border-acai-600 px-3 text-sm text-acai-100">
              <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
              Disponível para venda
            </label>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-20 w-full rounded-lg p-2"
            placeholder="Descrição (opcional)"
          />

          <div className="rounded-lg border border-acai-600 bg-acai-900/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium text-acai-100">Produtos relacionados (filhos)</h2>
              <button type="button" onClick={addRelatedItem} className="rounded-md bg-fuchsia-700 px-2 py-1 text-xs text-white">
                Adicionar relação
              </button>
            </div>
            <div className="space-y-2">
              {relatedItems.length === 0 ? (
                <p className="text-xs text-acai-300">Nenhuma relação adicionada.</p>
              ) : null}
              {relatedItems.map((relation, index) => (
                <div key={`${relation.childProductId}-${index}`} className="grid gap-2 md:grid-cols-[1fr_140px_110px]">
                  <ThemedSelect
                    value={relation.childProductId}
                    onChange={(nextValue) =>
                      updateRelatedItem(index, { childProductId: nextValue })
                    }
                    options={[
                      { value: '', label: 'Selecione um item filho' },
                      ...possibleChildren.map((product) => ({
                        value: product.id,
                        label: `${product.name} (${product.category.name})`,
                      })),
                    ]}
                    className="w-full"
                  />
                  <ThemedSelect
                    value={relation.isPaid ? 'paid' : 'free'}
                    onChange={(nextValue) =>
                      updateRelatedItem(index, { isPaid: nextValue === 'paid' })
                    }
                    options={[
                      { value: 'free', label: 'Gratuito' },
                      { value: 'paid', label: 'Pago' },
                    ]}
                    className="w-full"
                  />
                  <button type="button" onClick={() => removeRelatedItem(index)} className="rounded-md border border-red-500 px-2 text-red-300 hover:bg-red-500/10">
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-fuchsia-600 p-2 text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Salvando...' : editingProductId ? 'Atualizar produto' : 'Salvar'}
          </button>
        </form>
      ) : null}
      {feedback ? <p className="mb-3 text-sm text-fuchsia-200">{feedback}</p> : null}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`product-skeleton-${index}`}
                className="animate-pulse rounded-lg border border-acai-600 bg-acai-900/70 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="h-16 w-16 rounded-lg border border-acai-700 bg-acai-800/80" />
                    <div className="space-y-2">
                      <div className="h-3 w-44 rounded bg-acai-700/80" />
                      <div className="h-3 w-28 rounded bg-acai-800/80" />
                      <div className="h-3 w-60 rounded bg-acai-800/80" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-7 w-16 rounded-md bg-acai-800/90" />
                    <div className="h-7 w-16 rounded-md bg-acai-800/90" />
                  </div>
                </div>
              </div>
            ))
          : null}
        {!isLoading
          ? visibleProducts.map((p) => (
          <div key={p.id} className="rounded-lg border border-acai-600 bg-acai-900/80 p-3 text-acai-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-lg border border-acai-700 bg-acai-950">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      width={120}
                      height={120}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-acai-400">
                      Sem foto
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name} - R$ {Number(p.price).toFixed(2)}</p>
                  <p className="text-xs text-acai-300">{p.category?.name}</p>
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-acai-400">{p.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="ml-auto flex min-w-[170px] flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500 px-2 py-1 text-xs text-fuchsia-200 hover:bg-fuchsia-500/10"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingId === p.id}
                    onClick={() => deleteProduct(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-500 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isDeletingId === p.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
                <span className="rounded-full border border-acai-500 bg-acai-800 px-2 py-0.5 text-xs text-acai-200">
                  {p.parentRelations.length} relacionamento(s)
                </span>
              </div>
            </div>
          </div>
            ))
          : null}
        {!isLoading && filteredProducts.length === 0 ? (
          <p className="text-sm text-acai-300">Nenhum produto encontrado com os filtros aplicados.</p>
        ) : null}
      </div>
      <div ref={loadMoreRef} className="h-4 w-full" />
      {hasMoreProducts ? (
        <p className="mt-2 text-center text-xs text-acai-400">Carregando mais produtos...</p>
      ) : null}
    </main>
  )
}
