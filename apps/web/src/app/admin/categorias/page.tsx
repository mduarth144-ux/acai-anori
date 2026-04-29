'use client'

import { Edit3, Plus, Search, Trash2 } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Category = { id: string; name: string; slug: string }
const CATEGORIES_BATCH_SIZE = 20

export default function AdminCategoriasPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [filterName, setFilterName] = useState('')
  const [filterSlug, setFilterSlug] = useState('')
  const [visibleCount, setVisibleCount] = useState(CATEGORIES_BATCH_SIZE)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setCategories(await fetch('/api/categories').then((res) => res.json()))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function resetForm() {
    setName('')
    setSlug('')
    setEditingCategoryId(null)
    setShowForm(false)
  }

  function startEdit(category: Category) {
    setEditingCategoryId(category.id)
    setName(category.name)
    setSlug(category.slug)
    setShowForm(true)
    setFeedback(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFeedback(null)
    setIsSaving(true)
    const response = await fetch(
      editingCategoryId ? `/api/categories?id=${editingCategoryId}` : '/api/categories',
      {
        method: editingCategoryId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      }
    )
    if (!response.ok) {
      setFeedback('Não foi possível salvar a categoria.')
      setIsSaving(false)
      return
    }
    resetForm()
    setFeedback(editingCategoryId ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.')
    await load()
    setIsSaving(false)
  }

  async function deleteCategory(category: Category) {
    const confirmDelete = window.confirm(`Excluir a categoria "${category.name}"?`)
    if (!confirmDelete) return

    setFeedback(null)
    setIsDeletingId(category.id)
    const response = await fetch(`/api/categories?id=${category.id}`, { method: 'DELETE' })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      setFeedback(payload?.message ?? 'Não foi possível excluir a categoria.')
      setIsDeletingId(null)
      return
    }
    if (editingCategoryId === category.id) resetForm()
    setFeedback('Categoria excluída com sucesso.')
    await load()
    setIsDeletingId(null)
  }

  const filteredCategories = useMemo(() => {
    const normalizedName = filterName.trim().toLowerCase()
    const normalizedSlug = filterSlug.trim().toLowerCase()
    return categories.filter((category) => {
      const nameMatch =
        normalizedName.length === 0 ||
        category.name.toLowerCase().includes(normalizedName)
      const slugMatch =
        normalizedSlug.length === 0 ||
        category.slug.toLowerCase().includes(normalizedSlug)
      return nameMatch && slugMatch
    })
  }, [categories, filterName, filterSlug])

  const visibleCategories = useMemo(
    () => filteredCategories.slice(0, visibleCount),
    [filteredCategories, visibleCount]
  )
  const hasMoreCategories = visibleCount < filteredCategories.length

  useEffect(() => {
    setVisibleCount(CATEGORIES_BATCH_SIZE)
  }, [filterName, filterSlug, categories.length])

  useEffect(() => {
    const observerTarget = loadMoreRef.current
    if (!observerTarget || !hasMoreCategories) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisibleCount((current) =>
          Math.min(current + CATEGORIES_BATCH_SIZE, filteredCategories.length)
        )
      },
      { rootMargin: '240px 0px' }
    )

    observer.observe(observerTarget)
    return () => observer.disconnect()
  }, [filteredCategories.length, hasMoreCategories])

  return (
    <main className="w-full">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">Categorias</h1>
      <div className="mb-4 grid gap-3 rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg md:grid-cols-4 md:items-end">
        <div className="md:col-span-1">
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
        </div>
        <div className="md:col-span-1">
          <label className="flex flex-col text-xs text-acai-200">
            Slug
            <input
              value={filterSlug}
              onChange={(e) => setFilterSlug(e.target.value)}
              placeholder="Filtrar por slug"
              className="border-acai-600 bg-acai-950/80 text-acai-50 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/50 hover:border-fuchsia-600 mt-1 min-h-11 w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm transition placeholder:text-acai-400 focus:outline-none focus-visible:ring-2"
            />
          </label>
        </div>
        <div className="hidden md:block md:col-span-1" />
        <button
          type="button"
          onClick={() => {
            setShowForm(true)
            setEditingCategoryId(null)
            setFeedback(null)
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-4 text-sm font-medium text-white hover:bg-fuchsia-500 md:col-span-1"
        >
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      {showForm ? (
        <form onSubmit={onSubmit} className="mb-4 grid gap-2 rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg md:grid-cols-[1fr_1fr_150px]">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-acai-600 bg-acai-950/80 text-acai-50 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/50 hover:border-fuchsia-600 min-h-11 w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm transition placeholder:text-acai-400 focus:outline-none focus-visible:ring-2"
            placeholder="Nome"
          />
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border-acai-600 bg-acai-950/80 text-acai-50 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/50 hover:border-fuchsia-600 min-h-11 w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm transition placeholder:text-acai-400 focus:outline-none focus-visible:ring-2"
            placeholder="Slug"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-lg bg-fuchsia-600 p-2 text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Salvando...' : editingCategoryId ? 'Atualizar' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-acai-500 px-3 text-sm text-acai-100 hover:bg-acai-700/60"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {feedback ? <p className="mb-3 text-sm text-fuchsia-200">{feedback}</p> : null}

      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`category-skeleton-${index}`}
                className="animate-pulse rounded-lg border border-acai-600 bg-acai-900/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-2">
                    <div className="h-3 w-40 rounded bg-acai-700/80" />
                    <div className="h-3 w-24 rounded bg-acai-800/80" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-7 w-16 rounded-md bg-acai-800/90" />
                    <div className="h-7 w-16 rounded-md bg-acai-800/90" />
                  </div>
                </div>
              </div>
            ))
          : null}
        {!isLoading ? visibleCategories.map((category) => (
          <div
            key={category.id}
            className="rounded-lg border border-acai-600 bg-acai-900/80 p-3 text-acai-100"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{category.name}</p>
                <p className="text-xs text-acai-300">{category.slug}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(category)}
                  className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500 px-2 py-1 text-xs text-fuchsia-200 hover:bg-fuchsia-500/10"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  type="button"
                  disabled={isDeletingId === category.id}
                  onClick={() => deleteCategory(category)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isDeletingId === category.id ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )) : null}
        {!isLoading && filteredCategories.length === 0 ? (
          <p className="text-sm text-acai-300">
            Nenhuma categoria encontrada com os filtros aplicados.
          </p>
        ) : null}
      </div>

      <div ref={loadMoreRef} className="h-4 w-full" />
      {hasMoreCategories ? (
        <p className="mt-2 text-center text-xs text-acai-400">Carregando mais categorias...</p>
      ) : null}
    </main>
  )
}
