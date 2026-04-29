import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const isAdmin = searchParams.get('admin') === '1'

  const data = await prisma.product.findMany({
    where: isAdmin ? undefined : { available: true },
    include: {
      category: true,
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
      parentRelations: item.parentRelations.map((relation) => ({
        ...relation,
        child: { ...relation.child, price: Number(relation.child.price) },
      })),
    }))
  )
}

export async function POST(request: Request) {
  const body = await request.json()
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
      parentRelations: {
        include: { child: { include: { category: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })
  return NextResponse.json({
    ...data,
    price: Number(data.price),
    parentRelations: data.parentRelations.map((relation) => ({
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
      parentRelations: {
        include: { child: { include: { category: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  return NextResponse.json({
    ...data,
    price: Number(data.price),
    parentRelations: data.parentRelations.map((relation) => ({
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
