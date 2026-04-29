'use client'

import Image from 'next/image'
import { Edit3, Plus, Search, Trash2 } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ProductFormModal,
  PendingGroup,
  PendingGroupOption,
  PendingReusableGroupAssignment,
  ProductType,
} from '../../../components/admin/product-form-modal'
import { ThemedSelect } from '../../../components/ui/themed-select'

type Category = { id: string; name: string }

type Product = {
  id: string
  name: string
  price: number
  description: string | null
  imageUrl?: string | null
  available: boolean
  type: ProductType
  selectionTitle?: string | null
  category: { id: string; name: string }
  customizations: Array<{
    id: string
    label: string
    required: boolean
    minSelect: number
    maxSelect?: number | null
    affectsPrice: boolean
    freeQuantity: number
    options: Array<{
      id: string
      optionProductId?: string | null
      name: string
      priceModifier: number
      optionProduct?: { id: string; name: string; price: number } | null
    }>
  }>
  groupAssignments?: Array<{
    groupTemplateId: string
    groupTemplate: { id: string; name: string }
  }>
}

type ReusableGroupTemplate = { id: string; name: string }

const PRODUCTS_BATCH_SIZE = 12

export default function AdminProdutosPage() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [productType, setProductType] = useState<ProductType>('FINAL')
  const [selectionTitle, setSelectionTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [available, setAvailable] = useState(true)
  const [filterName, setFilterName] = useState('')
  const [filterDescription, setFilterDescription] = useState('')
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'active' | 'inactive'>('all')
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_BATCH_SIZE)
  const [customizationGroups, setCustomizationGroups] = useState<PendingGroup[]>([])
  const [reusableGroupTemplates, setReusableGroupTemplates] = useState<ReusableGroupTemplate[]>([])
  const [reusableGroupAssignments, setReusableGroupAssignments] = useState<PendingReusableGroupAssignment[]>([])
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
      const [categoriesResp, productsResp, reusableTemplatesResp] = await Promise.all([
        fetch('/api/categories').then((res) => res.json()),
        fetch('/api/products?admin=1').then((res) => res.json()),
        fetch('/api/customization-group-templates').then((res) => res.json()),
      ])
      setCategories(categoriesResp)
      setProducts(productsResp)
      setReusableGroupTemplates(reusableTemplatesResp)
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
    setProductType('FINAL')
    setSelectionTitle('')
    setAvailable(true)
    setCustomizationGroups([])
    setReusableGroupAssignments([])
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
    setProductType(product.type ?? 'FINAL')
    setSelectionTitle(product.selectionTitle ?? '')
    setAvailable(product.available)
    setCustomizationGroups(
      (product.customizations ?? []).map((group) => ({
        label: group.label,
        required: group.required,
        minSelect: String(group.minSelect ?? 0),
        maxSelect: group.maxSelect == null ? '' : String(group.maxSelect),
        affectsPrice: group.affectsPrice ?? true,
        freeQuantity: String(group.freeQuantity ?? 0),
        options: (group.options ?? []).map((option) => ({
          optionProductId: option.optionProductId ?? option.optionProduct?.id ?? '',
          optionName: option.optionProduct?.name ?? option.name,
          priceModifier: String(Number(option.priceModifier ?? option.optionProduct?.price ?? 0)),
        })),
      }))
    )
    setReusableGroupAssignments(
      (product.groupAssignments ?? []).map((assignment) => ({
        groupTemplateId: assignment.groupTemplateId,
      }))
    )
    setFeedback(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFeedback(null)
    const groupsError = validateCustomizationGroups()
    if (groupsError) {
      setFeedback(groupsError)
      return
    }
    setIsSaving(true)
    const payload = {
      name,
      description: description || null,
      price: Number(price),
      categoryId,
      type: productType,
      selectionTitle: selectionTitle || null,
      available,
      customizationGroups: (productType === 'COMPOSED' ? customizationGroups : []).map((group) => ({
        label: group.label.trim(),
        required: group.required,
        minSelect: Number(group.minSelect || 0),
        maxSelect: group.maxSelect.trim() ? Number(group.maxSelect) : null,
        affectsPrice: group.affectsPrice,
        freeQuantity: Number(group.freeQuantity || 0),
        options: group.options
          .filter((option) => option.optionProductId)
          .map((option) => ({
            optionProductId: option.optionProductId,
            name: option.optionName,
            priceModifier: Number(option.priceModifier || 0),
          })),
      })),
      reusableGroupTemplateIds: productType === 'COMPOSED'
        ? reusableGroupAssignments
            .map((assignment) => assignment.groupTemplateId)
            .filter(Boolean)
        : [],
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

  function addReusableGroupAssignment() {
    setReusableGroupAssignments((prev) => [...prev, { groupTemplateId: '' }])
  }

  function removeReusableGroupAssignment(assignmentIndex: number) {
    setReusableGroupAssignments((prev) => prev.filter((_, index) => index !== assignmentIndex))
  }

  function updateReusableGroupAssignment(
    assignmentIndex: number,
    patch: Partial<PendingReusableGroupAssignment>
  ) {
    setReusableGroupAssignments((prev) =>
      prev.map((assignment, index) =>
        index === assignmentIndex ? { ...assignment, ...patch } : assignment
      )
    )
  }

  function addCustomizationGroup() {
    setCustomizationGroups((prev) => [
      ...prev,
      {
        label: '',
        required: false,
        minSelect: '0',
        maxSelect: '',
        affectsPrice: true,
        freeQuantity: '0',
        options: [],
      },
    ])
  }

  function removeCustomizationGroup(groupIndex: number) {
    setCustomizationGroups((prev) => prev.filter((_, index) => index !== groupIndex))
  }

  function updateCustomizationGroup(groupIndex: number, patch: Partial<PendingGroup>) {
    setCustomizationGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex ? { ...group, ...patch } : group
      )
    )
  }

  function addGroupOption(groupIndex: number) {
    setCustomizationGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              options: [...group.options, { optionProductId: '', optionName: '', priceModifier: '0' }],
            }
          : group
      )
    )
  }

  function removeGroupOption(groupIndex: number, optionIndex: number) {
    setCustomizationGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? { ...group, options: group.options.filter((_, current) => current !== optionIndex) }
          : group
      )
    )
  }

  function updateGroupOption(
    groupIndex: number,
    optionIndex: number,
    patch: Partial<PendingGroupOption>
  ) {
    setCustomizationGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              options: group.options.map((option, current) =>
                current === optionIndex ? { ...option, ...patch } : option
              ),
            }
          : group
      )
    )
  }

  function validateCustomizationGroups(): string | null {
    if (productType !== 'COMPOSED') return null
    if (customizationGroups.length === 0) {
      return 'Adicione pelo menos um grupo para produto composto.'
    }

    for (const [groupIndex, group] of customizationGroups.entries()) {
      if (!group.label.trim()) return `Grupo ${groupIndex + 1}: informe o nome do grupo.`
      if (!/^\d+$/.test(group.minSelect || '0')) return `Grupo ${groupIndex + 1}: mínimo inválido.`
      if (group.maxSelect.trim() && !/^\d+$/.test(group.maxSelect)) return `Grupo ${groupIndex + 1}: máximo inválido.`
      if (!/^\d+$/.test(group.freeQuantity || '0')) return `Grupo ${groupIndex + 1}: quantidade grátis inválida.`

      const min = Number(group.minSelect || 0)
      const max = group.maxSelect.trim() ? Number(group.maxSelect) : null
      if (max != null && max < min) return `Grupo ${groupIndex + 1}: máximo não pode ser menor que mínimo.`
      if (group.options.length === 0) return `Grupo ${groupIndex + 1}: adicione ao menos um item.`

      const seen = new Set<string>()
      for (const [optionIndex, option] of group.options.entries()) {
        if (!option.optionProductId) return `Grupo ${groupIndex + 1}, item ${optionIndex + 1}: selecione um acompanhamento.`
        if (seen.has(option.optionProductId)) return `Grupo ${groupIndex + 1}: item duplicado no mesmo grupo.`
        seen.add(option.optionProductId)
      }
    }

    return null
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

  const accompanimentProducts = products.filter(
    (product) => product.type === 'ACCOMPANIMENT' && product.id !== editingProductId
  )
  const accompanimentByNormalizedName = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of accompanimentProducts) {
      map.set(product.name.trim().toLowerCase(), product.id)
    }
    return map
  }, [accompanimentProducts])
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

  useEffect(() => {
    if (accompanimentByNormalizedName.size === 0) return
    setCustomizationGroups((prev) =>
      prev.map((group) => ({
        ...group,
        options: group.options.map((option) => {
          if (option.optionProductId) return option
          const byName = accompanimentByNormalizedName.get(String(option.optionName ?? '').trim().toLowerCase())
          return byName ? { ...option, optionProductId: byName } : option
        }),
      }))
    )
  }, [accompanimentByNormalizedName])

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

      <ProductFormModal
        isOpen={showForm}
        isSaving={isSaving}
        isEditing={Boolean(editingProductId)}
        name={name}
        price={price}
        description={description}
        categoryId={categoryId}
        productType={productType}
        selectionTitle={selectionTitle}
        available={available}
        customizationGroups={customizationGroups}
        reusableGroupAssignments={reusableGroupAssignments}
        categories={categories}
        accompanimentProducts={accompanimentProducts.map((p) => ({
          id: p.id,
          name: p.name,
          categoryName: p.category.name,
          price: Number(p.price),
        }))}
        reusableGroupTemplates={reusableGroupTemplates}
        onClose={resetForm}
        onSubmit={onSubmit}
        setName={setName}
        setPrice={setPrice}
        setDescription={setDescription}
        setCategoryId={setCategoryId}
        setProductType={setProductType}
        setSelectionTitle={setSelectionTitle}
        setAvailable={setAvailable}
        addCustomizationGroup={addCustomizationGroup}
        removeCustomizationGroup={removeCustomizationGroup}
        updateCustomizationGroup={updateCustomizationGroup}
        addGroupOption={addGroupOption}
        removeGroupOption={removeGroupOption}
        updateGroupOption={updateGroupOption}
        addReusableGroupAssignment={addReusableGroupAssignment}
        removeReusableGroupAssignment={removeReusableGroupAssignment}
        updateReusableGroupAssignment={updateReusableGroupAssignment}
      />
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
                  {p.type === 'ACCOMPANIMENT' ? 'Acompanhamento' : p.type === 'COMPOSED' ? 'Composto' : 'Final'} • {p.customizations.filter((g) => g.options.some((o) => o.optionProductId || o.optionProduct?.id)).length} grupo(s)
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
