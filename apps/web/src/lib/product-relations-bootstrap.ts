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

const VOLUME_PRODUCT_PATTERNS = [
  /\b\d+(?:[.,]\d+)?\s?(?:ml|l)\b/i,
  /\b(?:meio|1\/2)\s+litro\b/i,
  /\b(?:2|dois)\s+litros?\b/i,
  /\blitro(?:s)?\b/i,
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

export async function bootstrapVolumeComplements(prisma: PrismaClient) {
  const supportCategory = await prisma.category.upsert({
    where: { slug: 'itens-complementares-bebidas' },
    update: { name: 'Itens complementares bebidas', order: 998 },
    create: { slug: 'itens-complementares-bebidas', name: 'Itens complementares bebidas', order: 998 },
  })

  const [drinksKit, ice, cup, straw, lemon] = await Promise.all([
    upsertFreeProduct(prisma, {
      name: 'Complementos de bebidas',
      description: 'Complementos opcionais sem custo para bebidas de volume.',
      categoryId: supportCategory.id,
    }),
    upsertFreeProduct(prisma, {
      name: 'Gelo',
      description: 'Item opcional sem custo.',
      categoryId: supportCategory.id,
    }),
    upsertFreeProduct(prisma, {
      name: 'Copo descartável',
      description: 'Item opcional sem custo.',
      categoryId: supportCategory.id,
    }),
    upsertFreeProduct(prisma, {
      name: 'Canudo',
      description: 'Item opcional sem custo.',
      categoryId: supportCategory.id,
    }),
    upsertFreeProduct(prisma, {
      name: 'Limão',
      description: 'Item opcional sem custo.',
      categoryId: supportCategory.id,
    }),
  ])

  await Promise.all([
    ensureRelation(prisma, drinksKit.id, ice.id, false, 0),
    ensureRelation(prisma, drinksKit.id, cup.id, false, 1),
    ensureRelation(prisma, drinksKit.id, straw.id, false, 2),
    ensureRelation(prisma, drinksKit.id, lemon.id, false, 3),
  ])

  const excludedIds = [drinksKit.id, ice.id, cup.id, straw.id, lemon.id]
  const products = await prisma.product.findMany({
    where: { id: { notIn: excludedIds } },
    select: { id: true, name: true, description: true },
  })

  const masters = products.filter((product) =>
    isVolumeProduct(`${product.name} ${product.description ?? ''}`)
  )

  let createdForMasters = 0
  for (const master of masters) {
    const before = await prisma.productRelation.count({
      where: {
        parentProductId: master.id,
        childProductId: drinksKit.id,
      },
    })

    await ensureRelation(prisma, master.id, drinksKit.id, false, 0)

    const after = await prisma.productRelation.count({
      where: {
        parentProductId: master.id,
        childProductId: drinksKit.id,
      },
    })
    createdForMasters += Math.max(0, after - before)
  }

  let customizedMasters = 0
  for (const master of masters) {
    await upsertCustomizationGroup(prisma, {
      productId: master.id,
      label: 'Itens gratuitos (1 obrigatório)',
      minSelect: 1,
      affectsPrice: false,
      options: [
        { name: 'Leite ninho', priceModifier: 0 },
        { name: 'Kit-kat', priceModifier: 0 },
      ],
    })
    await upsertCustomizationGroup(prisma, {
      productId: master.id,
      label: 'Itens pagos (opcionais)',
      minSelect: 0,
      affectsPrice: true,
      options: [
        { name: 'Leite condensado', priceModifier: 1.5 },
        { name: 'Avelã', priceModifier: 1.5 },
        { name: 'Aveia', priceModifier: 1.5 },
      ],
    })
    customizedMasters += 1
  }

  return {
    categoryId: supportCategory.id,
    mastersLinked: masters.length,
    createdForMasters,
    customizedMasters,
    kit: {
      drinksKitId: drinksKit.id,
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

function isVolumeProduct(text: string) {
  const normalized = normalizeText(text)
  return VOLUME_PRODUCT_PATTERNS.some((pattern) => pattern.test(normalized))
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

async function upsertCustomizationGroup(
  prisma: PrismaClient,
  input: {
    productId: string
    label: string
    minSelect: number
    affectsPrice: boolean
    options: Array<{ name: string; priceModifier: number }>
  }
) {
  const existing = await prisma.productCustomization.findFirst({
    where: { productId: input.productId, label: input.label },
    orderBy: { id: 'asc' },
  })

  const baseData = {
    label: input.label,
    required: input.minSelect > 0,
    minSelect: input.minSelect,
    affectsPrice: input.affectsPrice,
    options: {
      create: input.options.map((option) => ({
        name: option.name,
        priceModifier: option.priceModifier,
      })),
    },
  }

  if (!existing) {
    await prisma.productCustomization.create({
      data: {
        productId: input.productId,
        ...baseData,
      },
    })
    return
  }

  await prisma.productCustomization.update({
    where: { id: existing.id },
    data: {
      label: baseData.label,
      required: baseData.required,
      minSelect: baseData.minSelect,
      affectsPrice: baseData.affectsPrice,
      options: {
        deleteMany: {},
        create: input.options.map((option) => ({
          name: option.name,
          priceModifier: option.priceModifier,
        })),
      },
    },
  })
}
