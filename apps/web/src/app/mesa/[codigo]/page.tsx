import { notFound } from 'next/navigation'
import { MenuPage } from '../../../components/menu/menu-page'
import { prisma } from '../../../lib/prisma'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ codigo: string }> }

export default async function MesaPage({ params }: Props) {
  const { codigo } = await params
  const table = await prisma.table.findUnique({ where: { code: codigo } })

  if (!table || !table.active) notFound()

  const [categories, productsRaw] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
    prisma.product.findMany({ where: { available: true }, include: { category: true }, orderBy: { order: 'asc' } }),
  ])

  const products = productsRaw.map((product) => ({ ...product, price: Number(product.price) }))

  return <MenuPage categories={categories} products={products} tableCode={table.code} />
}
