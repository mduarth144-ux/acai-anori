import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

type GroupInput = {
  label?: string
  required?: boolean
  minSelect?: number
  maxSelect?: number | null
  affectsPrice?: boolean
  freeQuantity?: number
  options?: Array<{ optionProductId?: string; priceModifier?: number; name?: string }>
}

function normalizeLegacyGroups(customizationGroupsInput: GroupInput[]) {
  return customizationGroupsInput.map((group) => ({
    label: String(group.label ?? '').trim() || 'Grupo',
    required: Boolean(group.required),
    minSelect: Math.max(0, Number(group.minSelect ?? 0)),
    maxSelect: Number.isFinite(group.maxSelect) ? Math.max(0, Number(group.maxSelect)) : null,
    affectsPrice: Boolean(group.affectsPrice ?? true),
    freeQuantity: Math.max(0, Number(group.freeQuantity ?? 0)),
    options: {
      create: (group.options ?? [])
        .filter((option) => option?.optionProductId)
        .map((option) => ({
          optionProductId: String(option.optionProductId),
          name: String(option.name ?? '').trim() || 'Item',
          priceModifier: Number(option.priceModifier ?? 0),
        })),
    },
  }))
}

function normalizeReusableGroupTemplateIds(input: unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of input) {
    const normalized = String(value ?? '').trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function resolveCustomizations(item: any) {
  const assignedGroups = (item.groupAssignments ?? []).map((assignment: any) => ({
    id: assignment.groupTemplate.id,
    label: assignment.groupTemplate.name,
    required: assignment.groupTemplate.required,
    minSelect: assignment.groupTemplate.minSelect,
    maxSelect: assignment.groupTemplate.maxSelect,
    affectsPrice: assignment.groupTemplate.affectsPrice,
    freeQuantity: assignment.groupTemplate.freeQuantity,
    options: assignment.groupTemplate.options.map((option: any) => ({
      id: option.id,
      name: option.name,
      priceModifier: Number(option.priceModifier),
      optionProduct: option.optionProduct
        ? { ...option.optionProduct, price: Number(option.optionProduct.price) }
        : null,
    })),
  }))

  if (assignedGroups.length > 0) return assignedGroups

  return item.customizations.map((customization: any) => ({
    ...customization,
    options: customization.options.map((option: any) => ({
      ...option,
      priceModifier: Number(option.priceModifier),
      optionProduct: option.optionProduct
        ? { ...option.optionProduct, price: Number(option.optionProduct.price) }
        : null,
    })),
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const isAdmin = searchParams.get('admin') === '1'

  const data = await prisma.product.findMany({
    where: isAdmin ? undefined : { available: true },
    include: {
      category: true,
      customizations: {
        include: { options: { include: { optionProduct: true } } },
      },
      groupAssignments: {
        include: {
          groupTemplate: {
            include: {
              options: {
                include: { optionProduct: true },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      parentRelations: {
        include: { child: { include: { category: true } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(
    data.map((item) => ({
      ...item,
      price: Number(item.price),
      customizations: resolveCustomizations(item),
      parentRelations: item.parentRelations.map((relation) => ({
        ...relation,
        child: { ...relation.child, price: Number(relation.child.price) },
      })),
    }))
  )
}

export async function POST(request: Request) {
  const body = await request.json()
  const customizationGroupsInput = Array.isArray(body.customizationGroups)
    ? body.customizationGroups
    : []
  const reusableGroupTemplateIdsInput = Array.isArray(body.reusableGroupTemplateIds)
    ? body.reusableGroupTemplateIds
    : []
  const reusableGroupTemplateIds = normalizeReusableGroupTemplateIds(
    reusableGroupTemplateIdsInput
  )
  const relatedItemsInput = Array.isArray(body.relatedItems) ? body.relatedItems : []
  const dedupedRelationMap = new Map<string, { childProductId: string; isPaid: boolean; order: number }>()
  for (const [index, item] of relatedItemsInput.entries()) {
    if (!item?.childProductId || item.childProductId === body.id) continue
    dedupedRelationMap.set(item.childProductId, {
      childProductId: item.childProductId,
      isPaid: Boolean(item.isPaid),
      order: Number.isFinite(item.order) ? item.order : index,
    })
  }
  const relatedItems = [...dedupedRelationMap.values()]
  const data = await prisma.product.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      price: body.price,
      categoryId: body.categoryId,
      available: body.available ?? true,
      type: body.type ?? 'FINAL',
      selectionTitle: body.selectionTitle?.trim() || null,
      customizations: customizationGroupsInput.length > 0
        ? {
            create: normalizeLegacyGroups(customizationGroupsInput),
          }
        : undefined,
      groupAssignments: reusableGroupTemplateIds.length > 0
        ? {
            create: reusableGroupTemplateIds.map((groupTemplateId, index) => ({
              groupTemplate: { connect: { id: groupTemplateId } },
              order: index,
            })),
          }
        : undefined,
      parentRelations: relatedItems.length > 0
        ? {
            create: relatedItems
              .filter((item: { childProductId?: string }) => item.childProductId)
              .map((item: { childProductId: string; isPaid?: boolean; order?: number }) => ({
                childProductId: item.childProductId,
                isPaid: Boolean(item.isPaid),
                order: Number.isFinite(item.order) ? item.order : 0,
              })),
          }
        : undefined,
    },
    include: {
      category: true,
      customizations: {
        include: { options: { include: { optionProduct: true } } },
      },
      groupAssignments: {
        include: {
          groupTemplate: {
            include: {
              options: {
                include: { optionProduct: true },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      parentRelations: {
        include: { child: { include: { category: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })
  return NextResponse.json({
    ...data,
    price: Number(data.price),
    customizations: resolveCustomizations(data),
    parentRelations: data.parentRelations.map((relation: any) => ({
      ...relation,
      child: { ...relation.child, price: Number(relation.child.price) },
    })),
  })
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'id obrigatório' }, { status: 400 })

  const body = await request.json()
  const customizationGroupsInput = Array.isArray(body.customizationGroups)
    ? body.customizationGroups
    : []
  const reusableGroupTemplateIdsInput = Array.isArray(body.reusableGroupTemplateIds)
    ? body.reusableGroupTemplateIds
    : []
  const reusableGroupTemplateIds = normalizeReusableGroupTemplateIds(
    reusableGroupTemplateIdsInput
  )
  const relatedItemsInput = Array.isArray(body.relatedItems) ? body.relatedItems : []
  const dedupedRelationMap = new Map<string, { childProductId: string; isPaid: boolean; order: number }>()
  for (const [index, item] of relatedItemsInput.entries()) {
    if (!item?.childProductId || item.childProductId === id) continue
    dedupedRelationMap.set(item.childProductId, {
      childProductId: item.childProductId,
      isPaid: Boolean(item.isPaid),
      order: Number.isFinite(item.order) ? item.order : index,
    })
  }
  const relatedItems = [...dedupedRelationMap.values()]

  const data = await prisma.product.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? null,
      price: body.price,
      categoryId: body.categoryId,
      available: body.available ?? true,
      type: body.type ?? 'FINAL',
      selectionTitle: body.selectionTitle?.trim() || null,
      customizations: {
        deleteMany: {},
        create: normalizeLegacyGroups(customizationGroupsInput),
      },
      groupAssignments: {
        deleteMany: {},
        create: reusableGroupTemplateIds.map((groupTemplateId, index) => ({
          groupTemplate: { connect: { id: groupTemplateId } },
          order: index,
        })),
      },
      parentRelations: {
        deleteMany: {},
        create: relatedItems.map((item) => ({
          childProductId: item.childProductId,
          isPaid: Boolean(item.isPaid),
          order: Number.isFinite(item.order) ? item.order : 0,
        })),
      },
    },
    include: {
      category: true,
      customizations: {
        include: { options: { include: { optionProduct: true } } },
      },
      groupAssignments: {
        include: {
          groupTemplate: {
            include: {
              options: {
                include: { optionProduct: true },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      parentRelations: {
        include: { child: { include: { category: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  return NextResponse.json({
    ...data,
    price: Number(data.price),
    customizations: resolveCustomizations(data),
    parentRelations: data.parentRelations.map((relation: any) => ({
      ...relation,
      child: { ...relation.child, price: Number(relation.child.price) },
    })),
  })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'id obrigatório' }, { status: 400 })

  await prisma.product.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
