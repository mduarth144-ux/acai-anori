'use client'

import { FormEvent, useEffect, useState } from 'react'
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
  category: { id: string; name: string }
  parentRelations: ProductRelation[]
}

type PendingRelation = {
  childProductId: string
  isPaid: boolean
}

export default function AdminProdutosPage() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [available, setAvailable] = useState(true)
  const [relatedItems, setRelatedItems] = useState<PendingRelation[]>([])
  const [loadingBootstrap, setLoadingBootstrap] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])

  async function load() {
    const [categoriesResp, productsResp] = await Promise.all([
      fetch('/api/categories').then((res) => res.json()),
      fetch('/api/products?admin=1').then((res) => res.json()),
    ])
    setCategories(categoriesResp)
    setProducts(productsResp)
    if (!categoryId && categoriesResp.length > 0) setCategoryId(categoriesResp[0].id)
  }

  useEffect(() => { load() }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFeedback(null)
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
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      setFeedback('Não foi possível salvar o produto.')
      return
    }
    setName('')
    setDescription('')
    setPrice('')
    setAvailable(true)
    setRelatedItems([])
    setFeedback('Produto salvo com sucesso.')
    await load()
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

  async function createDefaultComplements() {
    setLoadingBootstrap(true)
    setFeedback(null)
    const response = await fetch('/api/products/bootstrap-complements', { method: 'POST' })
    const result = await response.json()
    if (!response.ok) {
      setFeedback('Falha ao criar complementos padrão.')
      setLoadingBootstrap(false)
      return
    }
    setFeedback(
      `Estrutura criada/atualizada. Sanduíches vinculados: ${result?.sandwich?.mastersLinked ?? 0}. Bebidas por volume vinculadas: ${result?.volume?.mastersLinked ?? 0}. Produtos com grupos configurados: ${result?.volume?.customizedMasters ?? 0}.`
    )
    await load()
    setLoadingBootstrap(false)
  }

  const possibleChildren = products

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-fuchsia-100">Produtos</h1>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          disabled={loadingBootstrap}
          onClick={createDefaultComplements}
          className="rounded-lg border border-fuchsia-400 bg-acai-900/80 px-3 py-2 text-sm text-fuchsia-200 hover:bg-acai-800 disabled:opacity-50"
        >
          {loadingBootstrap
            ? 'Criando padrão...'
            : 'Criar padrão (Sanduíches + Bebidas por volume)'}
        </button>
      </div>

      <form onSubmit={onSubmit} className="mb-4 space-y-3 rounded-xl border border-acai-600 bg-acai-800/90 p-4 shadow-lg">
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

        <button type="submit" className="rounded-lg bg-fuchsia-600 p-2 text-white hover:bg-fuchsia-500">Salvar</button>
      </form>
      {feedback ? <p className="mb-3 text-sm text-fuchsia-200">{feedback}</p> : null}
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="rounded-lg border border-acai-600 bg-acai-900/80 p-3 text-acai-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{p.name} - R$ {Number(p.price).toFixed(2)}</p>
                <p className="text-xs text-acai-300">{p.category?.name}</p>
              </div>
              <span className="rounded-md bg-acai-700 px-2 py-1 text-xs">
                {p.parentRelations.length} relacionado(s)
              </span>
            </div>
            {p.parentRelations.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {p.parentRelations.map((relation) => (
                  <span key={relation.id} className="rounded-md border border-acai-500 px-2 py-1 text-xs">
                    {relation.child.name} ({relation.isPaid ? 'pago' : 'gratuito'})
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  )
}
