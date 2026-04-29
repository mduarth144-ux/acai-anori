'use client'

import { FormEvent } from 'react'
import { ThemedSelect } from '../ui/themed-select'

export type ProductType = 'FINAL' | 'COMPOSED' | 'ACCOMPANIMENT'

export type PendingGroupOption = {
  optionProductId: string
  optionName?: string
  priceModifier: string
}

export type PendingGroup = {
  label: string
  required: boolean
  minSelect: string
  maxSelect: string
  affectsPrice: boolean
  freeQuantity: string
  options: PendingGroupOption[]
}

export type PendingReusableGroupAssignment = {
  groupTemplateId: string
}

type Category = { id: string; name: string }
type AccompanimentProduct = { id: string; name: string; categoryName: string; price: number }
type ReusableGroupTemplate = { id: string; name: string }

type Props = {
  isOpen: boolean
  isSaving: boolean
  isEditing: boolean
  name: string
  price: string
  description: string
  categoryId: string
  productType: ProductType
  selectionTitle: string
  available: boolean
  customizationGroups: PendingGroup[]
  reusableGroupAssignments: PendingReusableGroupAssignment[]
  categories: Category[]
  accompanimentProducts: AccompanimentProduct[]
  reusableGroupTemplates: ReusableGroupTemplate[]
  onClose: () => void
  onSubmit: (e: FormEvent) => void
  setName: (value: string) => void
  setPrice: (value: string) => void
  setDescription: (value: string) => void
  setCategoryId: (value: string) => void
  setProductType: (value: ProductType) => void
  setSelectionTitle: (value: string) => void
  setAvailable: (value: boolean) => void
  addCustomizationGroup: () => void
  removeCustomizationGroup: (groupIndex: number) => void
  updateCustomizationGroup: (groupIndex: number, patch: Partial<PendingGroup>) => void
  addGroupOption: (groupIndex: number) => void
  removeGroupOption: (groupIndex: number, optionIndex: number) => void
  updateGroupOption: (groupIndex: number, optionIndex: number, patch: Partial<PendingGroupOption>) => void
  addReusableGroupAssignment: () => void
  removeReusableGroupAssignment: (assignmentIndex: number) => void
  updateReusableGroupAssignment: (
    assignmentIndex: number,
    patch: Partial<PendingReusableGroupAssignment>
  ) => void
}

export function ProductFormModal(props: Props) {
  if (!props.isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-2 md:items-center md:p-4">
      <form onSubmit={props.onSubmit} className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-acai-600 bg-acai-800/95 p-4 shadow-2xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-fuchsia-200">
            {props.isEditing ? 'Editando produto' : 'Cadastro de produto'}
          </p>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-acai-500 px-3 py-1 text-xs text-acai-100 hover:bg-acai-700/60"
          >
            Cancelar
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <input required value={props.name} onChange={(e) => props.setName(e.target.value)} className="rounded-lg p-2" placeholder="Nome" />
          <input required value={props.price} onChange={(e) => props.setPrice(e.target.value)} className="rounded-lg p-2" placeholder="Preço" />
          <ThemedSelect
            value={props.categoryId}
            onChange={(nextValue) => props.setCategoryId(nextValue)}
            options={props.categories.map((c) => ({ value: c.id, label: c.name }))}
            className="w-full"
          />
          <ThemedSelect
            value={props.productType}
            onChange={(nextValue) => props.setProductType(nextValue as ProductType)}
            options={[
              { value: 'FINAL', label: 'Produto final' },
              { value: 'COMPOSED', label: 'Produto composto' },
              { value: 'ACCOMPANIMENT', label: 'Acompanhamento' },
            ]}
            className="w-full"
          />
          <label className="flex items-center gap-2 rounded-lg border border-acai-600 px-3 text-sm text-acai-100">
            <input type="checkbox" checked={props.available} onChange={(e) => props.setAvailable(e.target.checked)} />
            Disponível para venda
          </label>
          {props.productType === 'COMPOSED' ? (
            <input
              value={props.selectionTitle}
              onChange={(e) => props.setSelectionTitle(e.target.value)}
              className="rounded-lg p-2 md:col-span-2"
              placeholder="Título da modal de escolha (opcional)"
            />
          ) : null}
        </div>

        <textarea
          value={props.description}
          onChange={(e) => props.setDescription(e.target.value)}
          className="mt-2 min-h-20 w-full rounded-lg p-2"
          placeholder="Descrição (opcional)"
        />

        {props.productType === 'COMPOSED' ? (
          <div className="mt-2 rounded-lg border border-acai-600 bg-acai-900/40 p-3">
            <div className="mb-4 rounded-md border border-acai-700/60 p-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-medium text-acai-100">Grupos reutilizáveis</h2>
                <button
                  type="button"
                  onClick={props.addReusableGroupAssignment}
                  className="rounded-md bg-fuchsia-700 px-2 py-1 text-xs text-white"
                >
                  Vincular grupo
                </button>
              </div>
              <div className="space-y-2">
                {props.reusableGroupAssignments.length === 0 ? (
                  <p className="text-xs text-acai-300">Nenhum grupo reutilizável vinculado.</p>
                ) : null}
                {props.reusableGroupAssignments.map((assignment, assignmentIndex) => (
                  <div
                    key={`assignment-${assignmentIndex}`}
                    className="grid gap-2 md:grid-cols-[1fr_120px]"
                  >
                    <ThemedSelect
                      value={assignment.groupTemplateId}
                      onChange={(nextValue) =>
                        props.updateReusableGroupAssignment(assignmentIndex, {
                          groupTemplateId: nextValue,
                        })
                      }
                      options={[
                        { value: '', label: 'Selecione um grupo reutilizável' },
                        ...props.reusableGroupTemplates.map((template) => ({
                          value: template.id,
                          label: template.name,
                        })),
                      ]}
                      className="w-full"
                    />
                    <button
                      type="button"
                      onClick={() => props.removeReusableGroupAssignment(assignmentIndex)}
                      className="rounded-md border border-red-500 px-2 text-red-300 hover:bg-red-500/10"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium text-acai-100">Grupos de personalização</h2>
              <button type="button" onClick={props.addCustomizationGroup} className="rounded-md bg-fuchsia-700 px-2 py-1 text-xs text-white">
                Adicionar grupo
              </button>
            </div>
            <div className="space-y-2">
              {props.customizationGroups.length === 0 ? (
                <p className="text-xs text-acai-300">Nenhum grupo cadastrado.</p>
              ) : null}
              {props.customizationGroups.map((group, groupIndex) => (
                <div
                  key={`group-${groupIndex}`}
                  className={`space-y-2 rounded-md border p-2 ${!group.label.trim() || group.options.length === 0 ? 'border-amber-500/60' : 'border-acai-600'}`}
                >
                  <div className="grid gap-2 md:grid-cols-6">
                    <input
                      value={group.label}
                      onChange={(e) => props.updateCustomizationGroup(groupIndex, { label: e.target.value })}
                      className="rounded-lg p-2 md:col-span-2"
                      placeholder="Nome do grupo (ex: Molhos)"
                    />
                    <input
                      value={group.minSelect}
                      onChange={(e) => props.updateCustomizationGroup(groupIndex, { minSelect: e.target.value })}
                      className="rounded-lg p-2"
                      placeholder="Mínimo"
                    />
                    <input
                      value={group.maxSelect}
                      onChange={(e) => props.updateCustomizationGroup(groupIndex, { maxSelect: e.target.value })}
                      className="rounded-lg p-2"
                      placeholder="Máximo"
                    />
                    <input
                      value={group.freeQuantity}
                      onChange={(e) => props.updateCustomizationGroup(groupIndex, { freeQuantity: e.target.value })}
                      className="rounded-lg p-2"
                      placeholder="Qtd grátis"
                    />
                    <button type="button" onClick={() => props.removeCustomizationGroup(groupIndex)} className="rounded-md border border-red-500 px-2 text-red-300 hover:bg-red-500/10">
                      Remover grupo
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-xs text-acai-200">
                      <input
                        type="checkbox"
                        checked={group.required}
                        onChange={(e) => props.updateCustomizationGroup(groupIndex, { required: e.target.checked })}
                      />
                      Obrigatório
                    </label>
                    <label className="flex items-center gap-2 text-xs text-acai-200">
                      <input
                        type="checkbox"
                        checked={group.affectsPrice}
                        onChange={(e) => props.updateCustomizationGroup(groupIndex, { affectsPrice: e.target.checked })}
                      />
                      Afeta preço
                    </label>
                  </div>

                  <div className="space-y-2 rounded-md border border-acai-700/60 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-acai-100">Itens do grupo</p>
                      <button
                        type="button"
                        onClick={() => props.addGroupOption(groupIndex)}
                        className="rounded-md bg-fuchsia-700 px-2 py-1 text-xs text-white"
                      >
                        Adicionar item
                      </button>
                    </div>
                    {group.options.map((option, optionIndex) => (
                      <div key={`group-${groupIndex}-option-${optionIndex}`} className="grid gap-2 md:grid-cols-[1fr_140px_110px]">
                        <ThemedSelect
                          value={option.optionProductId}
                          onChange={(nextValue) => {
                            const selected = props.accompanimentProducts.find((product) => product.id === nextValue)
                            props.updateGroupOption(groupIndex, optionIndex, {
                              optionProductId: nextValue,
                              optionName: selected?.name ?? option.optionName,
                              priceModifier: selected ? String(Number(selected.price)) : option.priceModifier,
                            })
                          }}
                          options={[
                            { value: '', label: 'Selecione um acompanhamento' },
                            ...props.accompanimentProducts.map((product) => ({
                              value: product.id,
                              label: `${product.name} (${product.categoryName})`,
                            })),
                          ]}
                          className="w-full"
                        />
                        <input
                          value={option.priceModifier}
                          onChange={(e) => props.updateGroupOption(groupIndex, optionIndex, { priceModifier: e.target.value })}
                          className="rounded-lg p-2"
                          placeholder="Preço"
                        />
                        <button type="button" onClick={() => props.removeGroupOption(groupIndex, optionIndex)} className="rounded-md border border-red-500 px-2 text-red-300 hover:bg-red-500/10">
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-acai-600 bg-acai-900/40 p-3 text-xs text-acai-300">
            Grupos de personalização são usados apenas para produtos do tipo <b>Produto composto</b>.
          </div>
        )}

        <button
          type="submit"
          disabled={props.isSaving}
          className="mt-3 rounded-lg bg-fuchsia-600 p-2 text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {props.isSaving ? 'Salvando...' : props.isEditing ? 'Atualizar produto' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}
