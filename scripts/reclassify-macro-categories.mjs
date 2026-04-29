import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_MACRO_CATEGORIES = [
  { name: 'FROZEN', slug: 'frozen', order: 0 },
  { name: 'AÇAÍ', slug: 'acai', order: 1 },
  { name: 'SANDUICHES', slug: 'sanduiches', order: 2 },
  { name: 'REFRIGERANTES', slug: 'refrigerantes', order: 3 },
  { name: 'SUCOS', slug: 'sucos', order: 4 },
  { name: 'CERVEJAS', slug: 'cervejas', order: 5 },
  { name: 'BROWNIE', slug: 'brownie', order: 6 },
  { name: 'OUTROS', slug: 'outros', order: 7 },
]

async function ensureMacroCategoriesInDb() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MacroCategory" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "order" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "MacroCategory"
    ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "MacroCategory"
    ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true
  `)

  for (const macro of DEFAULT_MACRO_CATEGORIES) {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "MacroCategory" ("id", "name", "slug", "order", "active")
      VALUES (gen_random_uuid()::text, $1, $2, $3, true)
      ON CONFLICT ("slug")
      DO UPDATE SET "name" = EXCLUDED."name", "order" = EXCLUDED."order", "active" = true
      `,
      macro.name,
      macro.slug,
      macro.order
    )
  }

  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT "name", "slug", "order"
    FROM "MacroCategory"
    WHERE "active" = true
    ORDER BY "order" ASC, "name" ASC
    `
  )

  return rows
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

function classifyProduct(product) {
  const text = normalize(`${product.name} ${product.description ?? ''} ${product.category.name}`)

  const isBrownie = includesAny(text, [/\bbrownie\b/])
  if (isBrownie) return 'brownie'

  const hasAcai = /\bacai\b/.test(text)
  const isBeer = includesAny(text, [
    /\bcerveja\b/,
    /\bheineken\b/,
    /\bbrahma\b/,
    /\bskol\b/,
    /\bantarctica\b/,
    /\bstella\b/,
    /\bbud(?:weiser|uveiser)?\b/,
    /\bcorona\b/,
    /\bitaipava\b/,
    /\bdevassa\b/,
  ])
  if (isBeer) return 'cervejas'

  const isSoda = includesAny(text, [
    /\brefrigerante\b/,
    /\bcoca\b/,
    /\bguarana\b/,
    /\bfanta\b/,
    /\bsprite\b/,
    /\bpepsi\b/,
    /\bsoda\b/,
    /\btubaina\b/,
    /\bkuat\b/,
    /\bantartica\b/,
    /\bbare\b/,
    /\bschweppes\b/,
    /\bred[\s-]?bull\b/,
    /\bmonster\b/,
    /\benergetic[oa]\b/,
    /\bagua mineral\b/,
    /\bpepis\b/,
  ])
  if (isSoda) return 'refrigerantes'

  const isJuice = includesAny(text, [
    /\bsuco\b/,
    /\bpolpa\b/,
    /\bdetox\b/,
    /\bdel valle\b/,
    /\btampico\b/,
  ])
  if (isJuice) return 'sucos'

  const isSandwich = includesAny(text, [
    /\bsanduich(?:e|es)\b/,
    /\bsanduiche\b/,
    /\bhamburg(?:er|uer)\b/,
    /\bx[-\s]?(?:salada|bacon|tudo|egg|frango|calabresa|burguer|burger)\b/,
    /\bburger\b/,
    /\bmisto\b/,
    /\bbauru\b/,
    /\bwrap\b/,
    /\bsub\b/,
    /\bkikao\b/,
  ])
  if (isSandwich) return 'sanduiches'

  if (hasAcai) {
    const isFrozenAcai = includesAny(text, [
      /\bfrozen\b/,
      /\bmix\b/,
      /\bpote\b/,
      /\bcopo\b/,
      /\bbarca\b/,
      /\btaca\b/,
      /\bcreme\b/,
    ])
    if (isFrozenAcai) return 'frozen'
    return 'acai'
  }

  return 'outros'
}

async function main() {
  const macroCategories = await ensureMacroCategoriesInDb()
  const macroBySlug = new Map(macroCategories.map((item) => [item.slug, item]))

  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  })

  const categoriesBySlug = new Map()
  for (const macro of macroCategories) {
    const category = await prisma.category.upsert({
      where: { slug: macro.slug },
      update: { name: macro.name, order: macro.order },
      create: { name: macro.name, slug: macro.slug, order: macro.order },
    })
    categoriesBySlug.set(macro.slug, category)
  }

  const updates = []
  for (const product of products) {
    const targetSlug = classifyProduct(product)
    const targetCategory = categoriesBySlug.get(targetSlug)
    if (product.categoryId !== targetCategory.id) {
      updates.push(
        prisma.product.update({
          where: { id: product.id },
          data: { categoryId: targetCategory.id },
        })
      )
    }
  }

  if (updates.length > 0) await prisma.$transaction(updates)

  const macroCategoryIds = Array.from(categoriesBySlug.values()).map((c) => c.id)
  const emptyNonMacroCategories = await prisma.category.findMany({
    where: {
      id: { notIn: macroCategoryIds },
      products: { none: {} },
    },
    select: { id: true },
  })

  if (emptyNonMacroCategories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: emptyNonMacroCategories.map((c) => c.id) } },
    })
  }

  const byTarget = new Map(macroCategories.map((c) => [c.slug, 0]))
  for (const product of products) {
    const targetSlug = classifyProduct(product)
    byTarget.set(targetSlug, (byTarget.get(targetSlug) || 0) + 1)
  }

  const orderedCategories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    select: { name: true, slug: true, order: true },
  })

  const result = {
    totalProducts: products.length,
    movedProducts: updates.length,
    macroCategoriesFromDb: macroCategories,
    macroCategoriesBySlugInUse: Array.from(macroBySlug.keys()),
    categoryOrderInDb: orderedCategories,
    groupedCount: Object.fromEntries(byTarget.entries()),
    unknownCount: 0,
    unknownProducts: [],
  }

  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
