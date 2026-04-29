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
      },
      orderBy: { order: 'asc' },
    }),
  ])

  const products = productsRaw.map((product) => ({
    ...product,
    price: Number(product.price),
    customizations: product.customizations.map((customization) => ({
      ...customization,
      options: customization.options.map((option) => ({
        ...option,
        priceModifier: Number(option.priceModifier),
        optionProduct: option.optionProduct
          ? { ...option.optionProduct, price: Number(option.optionProduct.price) }
          : null,
      })),
    })),
  }))

  return <MenuPage categories={categories} products={products} />
}
