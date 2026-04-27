import { MenuPage } from '../components/menu/menu-page'
import { prisma } from '../lib/prisma'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [categories, productsRaw] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
    prisma.product.findMany({ where: { available: true }, include: { category: true }, orderBy: { order: 'asc' } }),
  ])

  const products = productsRaw.map((product) => ({
    ...product,
    price: Number(product.price),
  }))

  return <MenuPage categories={categories} products={products} />
}
