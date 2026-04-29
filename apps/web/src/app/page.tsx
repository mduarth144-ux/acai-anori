import { MenuPage } from '../components/menu/menu-page'
import { prisma } from '../lib/prisma'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [categories, productsRaw] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
    prisma.product.findMany({
      where: { available: true, type: { not: 'ACCOMPANIMENT' } },
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
      },
      orderBy: { order: 'asc' },
    }),
  ])

  const products = productsRaw.map((product) => {
    const customizations =
      product.groupAssignments.length > 0
        ? product.groupAssignments.map((assignment) => ({
            id: assignment.groupTemplate.id,
            label: assignment.groupTemplate.name,
            required: assignment.groupTemplate.required,
            minSelect: assignment.groupTemplate.minSelect,
            maxSelect: assignment.groupTemplate.maxSelect,
            affectsPrice: assignment.groupTemplate.affectsPrice,
            freeQuantity: assignment.groupTemplate.freeQuantity,
            options: assignment.groupTemplate.options.map((option) => ({
              id: option.id,
              name: option.name,
              priceModifier: Number(option.priceModifier),
              optionProduct: option.optionProduct
                ? {
                    id: option.optionProduct.id,
                    name: option.optionProduct.name,
                  }
                : null,
            })),
          }))
        : product.customizations.map((customization) => ({
            id: customization.id,
            label: customization.label,
            required: customization.required,
            minSelect: customization.minSelect,
            maxSelect: customization.maxSelect,
            affectsPrice: customization.affectsPrice,
            freeQuantity: customization.freeQuantity,
            options: customization.options.map((option) => ({
              id: option.id,
              name: option.name,
              priceModifier: Number(option.priceModifier),
              optionProduct: option.optionProduct
                ? {
                    id: option.optionProduct.id,
                    name: option.optionProduct.name,
                  }
                : null,
            })),
          }))

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      imageUrl: product.imageUrl,
      type: product.type,
      selectionTitle: product.selectionTitle,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      customizations,
    }
  })

  return <MenuPage categories={categories} products={products} />
}
