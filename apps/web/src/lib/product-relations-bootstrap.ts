import { PrismaClient } from '@prisma/client'

const TARGET_CATEGORY_SLUGS = [
  'sanduiche',
  'sanduiches',
  'lanche',
  'lanches',
  'hamburger',
  'hamburguer',
  'hamburgers',
]

export async function bootstrapSandwichComplements(prisma: PrismaClient) {
  const supportCategory = await prisma.category.upsert({
    where: { slug: 'itens-complementares' },
    update: { name: 'Itens complementares', order: 999 },
    create: { slug: 'itens-complementares', name: 'Itens complementares', order: 999 },
  })

  const [disposableKit, napkin, cup, cutlery, saucesKit, ketchup, mayonnaise, mustard] =
    await Promise.all([
      upsertFreeProduct(prisma, {
        name: 'Descartáveis',
        description: 'Kit de itens de apoio para pedidos de sanduíche/lanche/hambúrguer.',
        categoryId: supportCategory.id,
      }),
      upsertFreeProduct(prisma, {
        name: 'Guardanapo',
        description: 'Item de apoio sem custo.',
        categoryId: supportCategory.id,
      }),
      upsertFreeProduct(prisma, {
        name: 'Copo descartável',
        description: 'Item de apoio sem custo.',
        categoryId: supportCategory.id,
      }),
      upsertFreeProduct(prisma, {
        name: 'Talheres descartáveis',
        description: 'Item de apoio sem custo.',
        categoryId: supportCategory.id,
      }),
      upsertFreeProduct(prisma, {
        name: 'Molhos',
        description: 'Kit de molhos para pedidos de sanduíche/lanche/hambúrguer.',
        categoryId: supportCategory.id,
      }),
      upsertFreeProduct(prisma, {
        name: 'Catchup',
        description: 'Molho sem custo.',
        categoryId: supportCategory.id,
      }),
      upsertFreeProduct(prisma, {
        name: 'Maionese',
        description: 'Molho sem custo.',
        categoryId: supportCategory.id,
      }),
      upsertFreeProduct(prisma, {
        name: 'Mostarda',
        description: 'Molho sem custo.',
        categoryId: supportCategory.id,
      }),
    ])

  await Promise.all([
    ensureRelation(prisma, disposableKit.id, napkin.id, false, 0),
    ensureRelation(prisma, disposableKit.id, cup.id, false, 1),
    ensureRelation(prisma, disposableKit.id, cutlery.id, false, 2),
    ensureRelation(prisma, saucesKit.id, ketchup.id, false, 0),
    ensureRelation(prisma, saucesKit.id, mayonnaise.id, false, 1),
    ensureRelation(prisma, saucesKit.id, mustard.id, false, 2),
  ])

  const masters = await prisma.product.findMany({
    where: {
      category: { slug: { in: TARGET_CATEGORY_SLUGS } },
      id: { notIn: [disposableKit.id, saucesKit.id] },
    },
    select: { id: true },
  })

  let createdForMasters = 0
  for (const master of masters) {
    const before = await prisma.productRelation.count({
      where: {
        parentProductId: master.id,
        childProductId: { in: [disposableKit.id, saucesKit.id] },
      },
    })

    await Promise.all([
      ensureRelation(prisma, master.id, disposableKit.id, false, 0),
      ensureRelation(prisma, master.id, saucesKit.id, false, 1),
    ])

    const after = await prisma.productRelation.count({
      where: {
        parentProductId: master.id,
        childProductId: { in: [disposableKit.id, saucesKit.id] },
      },
    })
    createdForMasters += Math.max(0, after - before)
  }

  return {
    categoryId: supportCategory.id,
    mastersLinked: masters.length,
    createdForMasters,
    kits: {
      disposableKitId: disposableKit.id,
      saucesKitId: saucesKit.id,
    },
  }
}

async function upsertFreeProduct(
  prisma: PrismaClient,
  input: { name: string; description: string; categoryId: string }
) {
  const existing = await prisma.product.findFirst({
    where: { name: input.name, categoryId: input.categoryId },
    orderBy: { createdAt: 'asc' },
  })

  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: { description: input.description, price: 0, available: true },
    })
  }

  return prisma.product.create({
    data: {
      name: input.name,
      description: input.description,
      price: 0,
      available: true,
      categoryId: input.categoryId,
    },
  })
}

async function ensureRelation(
  prisma: PrismaClient,
  parentProductId: string,
  childProductId: string,
  isPaid: boolean,
  order: number
) {
  if (parentProductId === childProductId) return
  await prisma.productRelation.upsert({
    where: { parentProductId_childProductId: { parentProductId, childProductId } },
    update: { isPaid, order },
    create: { parentProductId, childProductId, isPaid, order },
  })
}
