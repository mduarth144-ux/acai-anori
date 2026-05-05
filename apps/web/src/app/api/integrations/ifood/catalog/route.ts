import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import {
  batchUpdateProductPrices,
  batchUpdateProductsByExternalCode,
  createOrUpdateCategory,
  createOrUpdateComplement,
  createOrUpdateItem,
  createOrUpdateProduct,
  deleteCatalogEntity,
  listCatalogs,
  listCategories,
  listProducts,
  listRestrictedItems,
  updateCatalogEntityStatus,
  uploadCatalogImage,
} from '../../../../../lib/integrations/ifood/client'
import {
  mapCategoryToIfoodCategory,
  mapProductToIfoodProduct,
} from '../../../../../lib/integrations/ifood/catalog-mapper'
import { isIfoodInternalRequestAuthorized } from '../_shared/auth'

function getPrimaryCatalogId(payload: Record<string, unknown>): string | null {
  const list = payload.items
  if (Array.isArray(list)) {
    const first = list[0] as Record<string, unknown> | undefined
    const id = first?.id
    if (typeof id === 'string') return id
  }
  return null
}

export async function GET(request: Request) {
  if (!isIfoodInternalRequestAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')?.trim() || 'catalogs'
  const catalogId = searchParams.get('catalogId')?.trim()

  try {
    if (action === 'catalogs') {
      return NextResponse.json({ ok: true, data: await listCatalogs() })
    }
    if (action === 'restricted-items') {
      return NextResponse.json({ ok: true, data: await listRestrictedItems() })
    }
    if (!catalogId) {
      return NextResponse.json({ message: 'catalogId obrigatorio para esta acao' }, { status: 400 })
    }
    if (action === 'categories') {
      return NextResponse.json({ ok: true, data: await listCategories(catalogId) })
    }
    if (action === 'products') {
      return NextResponse.json({ ok: true, data: await listProducts(catalogId) })
    }
    return NextResponse.json({ message: 'acao invalida' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar catalogo iFood'
    return NextResponse.json({ message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  if (!isIfoodInternalRequestAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    action?:
      | 'SYNC_ALL'
      | 'BATCH_PRICE'
      | 'BATCH_EXTERNAL_CODE'
      | 'UPSERT_CATEGORY'
      | 'UPSERT_PRODUCT'
      | 'UPSERT_ITEM'
      | 'UPSERT_COMPLEMENT'
      | 'DELETE_ENTITY'
      | 'UPDATE_STATUS'
      | 'UPLOAD_IMAGE'
    catalogId?: string
    payload?: Record<string, unknown>
    entity?: 'categories' | 'products' | 'items' | 'complements'
    entityId?: string
  }

  try {
    if (body.action === 'UPLOAD_IMAGE') {
      const payload = body.payload as { fileName?: string; mimeType?: string; contentBase64?: string }
      if (!payload?.fileName || !payload.mimeType || !payload.contentBase64) {
        return NextResponse.json(
          { message: 'payload com fileName, mimeType e contentBase64 e obrigatorio' },
          { status: 400 }
        )
      }
      const data = await uploadCatalogImage(payload as {
        fileName: string
        mimeType: string
        contentBase64: string
      })
      return NextResponse.json({ ok: true, data })
    }

    if (body.action === 'UPDATE_STATUS') {
      const payload = body.payload as { entity?: 'products' | 'items'; status?: 'AVAILABLE' | 'UNAVAILABLE' }
      if (!payload?.entity || !payload.status || !body.entityId) {
        return NextResponse.json(
          { message: 'payload.entity, payload.status e entityId sao obrigatorios' },
          { status: 400 }
        )
      }
      const data = await updateCatalogEntityStatus({
        entity: payload.entity,
        id: body.entityId,
        status: payload.status,
      })
      return NextResponse.json({ ok: true, data })
    }

    if (body.action === 'DELETE_ENTITY') {
      if (!body.entity || !body.entityId) {
        return NextResponse.json({ message: 'entity e entityId sao obrigatorios' }, { status: 400 })
      }
      await deleteCatalogEntity(body.entity, body.entityId)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'BATCH_EXTERNAL_CODE') {
      const updates = Array.isArray(body.payload?.updates)
        ? (body.payload?.updates as Array<Record<string, unknown>>)
        : []
      const data = await batchUpdateProductsByExternalCode(updates)
      return NextResponse.json({ ok: true, data, updated: updates.length })
    }

    if (body.action === 'UPSERT_ITEM') {
      const data = await createOrUpdateItem((body.payload ?? {}) as any)
      return NextResponse.json({ ok: true, data })
    }

    if (body.action === 'UPSERT_COMPLEMENT') {
      const data = await createOrUpdateComplement((body.payload ?? {}) as any)
      return NextResponse.json({ ok: true, data })
    }

    if (body.action === 'UPSERT_CATEGORY') {
      if (!body.catalogId || !body.payload) {
        return NextResponse.json({ message: 'catalogId e payload sao obrigatorios' }, { status: 400 })
      }
      const data = await createOrUpdateCategory(body.catalogId, body.payload as any)
      return NextResponse.json({ ok: true, data })
    }

    if (body.action === 'UPSERT_PRODUCT') {
      if (!body.catalogId || !body.payload) {
        return NextResponse.json({ message: 'catalogId e payload sao obrigatorios' }, { status: 400 })
      }
      const data = await createOrUpdateProduct(body.catalogId, body.payload as any)
      return NextResponse.json({ ok: true, data })
    }

    if (body.action === 'BATCH_PRICE') {
      const products = await prisma.product.findMany({
        select: { id: true, price: true },
      })
      const data = await batchUpdateProductPrices(
        products.map((product) => ({
          externalCode: `product:${product.id}`,
          price: Number(product.price),
        }))
      )
      return NextResponse.json({ ok: true, data, updated: products.length })
    }

    const catalogs = (await listCatalogs()) as Record<string, unknown>
    const catalogId = getPrimaryCatalogId(catalogs)
    if (!catalogId) {
      return NextResponse.json({ message: 'Nao foi possivel determinar catalogId principal' }, { status: 422 })
    }

    const [categories, products] = await Promise.all([
      prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          price: true,
          available: true,
          categoryId: true,
        },
      }),
    ])

    for (const category of categories) {
      await createOrUpdateCategory(catalogId, mapCategoryToIfoodCategory(category))
    }
    for (const product of products) {
      await createOrUpdateProduct(catalogId, mapProductToIfoodProduct({ product }))
    }

    return NextResponse.json({
      ok: true,
      synced: {
        categories: categories.length,
        products: products.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar catalogo iFood'
    return NextResponse.json({ message }, { status: 502 })
  }
}
