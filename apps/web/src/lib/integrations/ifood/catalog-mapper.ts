import type { Prisma } from '@prisma/client'
import type { IfoodCatalogCategory, IfoodCatalogProduct } from './types'

export function toExternalCode(prefix: string, id: string): string {
  return `${prefix}:${id}`
}

export function mapCategoryToIfoodCategory(category: { id: string; name: string; slug: string }): IfoodCatalogCategory {
  return {
    externalCode: toExternalCode('category', category.id),
    name: category.name,
    description: category.slug,
    status: 'AVAILABLE',
  }
}

export function mapProductToIfoodProduct(params: {
  product: {
    id: string
    name: string
    description: string | null
    price: Prisma.Decimal | number
    available: boolean
    categoryId: string
    imageUrl: string | null
  }
}): IfoodCatalogProduct {
  return {
    externalCode: toExternalCode('product', params.product.id),
    categoryExternalCode: toExternalCode('category', params.product.categoryId),
    name: params.product.name,
    description: params.product.description ?? undefined,
    imageUrl: params.product.imageUrl ?? undefined,
    status: params.product.available ? 'AVAILABLE' : 'UNAVAILABLE',
    price: Number(params.product.price),
  }
}
