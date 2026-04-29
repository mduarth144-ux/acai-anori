import { Prisma, PrismaClient } from '../generated/prisma-script-client/index.js'

const prisma = new PrismaClient()

const TARGET_PRODUCTS = [
  'Açaí Frozen Tradicional',
  'Açaí Frozen Especial',
  'Açaí Frozen Mix',
]

const GROUPS = [
  {
    name: 'ACOMPANHAMENTOS SIMPLES',
    slug: 'acompanhamentos-simples',
    required: false,
    minSelect: 0,
    maxSelect: null,
    affectsPrice: false,
    freeQuantity: 0,
    items: [
      ['Tapioca crocante', 0],
      ['Aveia', 0],
      ['Flocos de arroz', 0],
      ['Granola', 0],
      ['Jujuba', 0],
      ['Neston', 0],
      ['Amedoim grande', 0],
      ['Paçoca', 0],
      ['Chocobol grande', 0],
      ['Farinha Láctea', 0],
      ['Disquete pequeno', 0],
    ],
  },
  {
    name: 'ACOMPANHAMENTOS PREMIUM',
    slug: 'acompanhamentos-premium',
    required: false,
    minSelect: 0,
    maxSelect: null,
    affectsPrice: true,
    freeQuantity: 0,
    items: [
      ['Disquete grande', 4.5], ['Disquete pequeno', 4.5], ['Chocobol grande', 4.5], ['Chocobol pequeno', 4.5],
      ['Amedoim grande', 4.5], ['Amedoim triturado', 4.5], ['Ovomaltine', 5], ['Farinha Lacta', 4.5],
      ['Neston', 4.5], ['Leite Ninho', 5], ['Flocos de arroz', 4.5], ['Aveia crocante', 4.5],
      ['Cereal de banana', 4.5], ['Granola completa', 4.5], ['Jujuba', 4.5], ['Tapioca crocante', 4.5],
      ['Castanha de caju', 7.5], ['Castanha do Brasil', 7.5], ['Fruta morango', 7.5], ['Fruta kiwi', 7.5],
      ['Fruta banana', 6], ['Bis', 4], ['Gotas de chocolate', 4.5], ['Kit Kat', 7],
      ['Nutela', 8], ['Oreo triturado', 6], ['Ouro Branco', 4.5], ['Sonho de Valsa', 4.5],
    ],
  },
  {
    name: 'BOLAS ADICIONAIS PREMIUM',
    slug: 'bolas-adicionais-premium',
    required: false,
    minSelect: 0,
    maxSelect: null,
    affectsPrice: true,
    freeQuantity: 0,
    items: [
      ['1 Bola de sorvete de morango', 4.5],
      ['1 bola de sorvete de chocolate', 4.5],
      ['1 bola de sorvete de cupuaçu', 4.5],
    ],
  },
  {
    name: 'CALDAS PREMIUM',
    slug: 'caldas-premium',
    required: false,
    minSelect: 0,
    maxSelect: null,
    affectsPrice: true,
    freeQuantity: 0,
    items: [
      ['Calda de chocolate', 4],
      ['Calda de leite condensado', 4],
      ['Calda de morango', 4],
      ['Calda de banana', 4],
    ],
  },
  {
    name: 'CALDAS SIMPLES',
    slug: 'caldas-simples',
    required: false,
    minSelect: 0,
    maxSelect: null,
    affectsPrice: false,
    freeQuantity: 0,
    items: [
      ['Sem calda', 0],
      ['Calda de chocolate', 0],
      ['Calda de morango', 0],
      ['Calda de leite condensado', 0],
      ['Calda de banana', 0],
    ],
  },
]

function norm(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { slug: 'acompanhamentos' },
    update: { name: 'Acompanhamentos' },
    create: { slug: 'acompanhamentos', name: 'Acompanhamentos', order: 999 },
  })
}

async function ensureAccompaniments() {
  const category = await ensureCategory()
  const allNames = new Map()
  for (const group of GROUPS) {
    for (const [name] of group.items) {
      const key = norm(name)
      if (!allNames.has(key)) allNames.set(key, name)
    }
  }

  let created = 0
  let updated = 0
  const accompanimentIdByName = new Map()

  for (const name of allNames.values()) {
    const existing = await prisma.product.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })

    const data = {
      name,
      type: 'ACCOMPANIMENT',
      categoryId: category.id,
      price: new Prisma.Decimal('0.00'),
      available: true,
      description: 'Acompanhamento reutilizável para produtos compostos.',
    }

    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data })

    if (existing) updated += 1
    else created += 1

    accompanimentIdByName.set(norm(name), product.id)
  }

  return { accompanimentIdByName, created, updated }
}

async function upsertTemplates(accompanimentIdByName) {
  const templateIds = []

  for (const group of GROUPS) {
    const template = await prisma.customizationGroupTemplate.upsert({
      where: { slug: group.slug },
      update: {
        name: group.name,
        required: group.required,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        affectsPrice: group.affectsPrice,
        freeQuantity: group.freeQuantity,
        options: {
          deleteMany: {},
          create: group.items.map(([name, price], index) => ({
            name,
            order: index,
            priceModifier: new Prisma.Decimal(Number(price).toFixed(2)),
            optionProductId: accompanimentIdByName.get(norm(name)) ?? null,
          })),
        },
      },
      create: {
        name: group.name,
        slug: group.slug,
        required: group.required,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        affectsPrice: group.affectsPrice,
        freeQuantity: group.freeQuantity,
        options: {
          create: group.items.map(([name, price], index) => ({
            name,
            order: index,
            priceModifier: new Prisma.Decimal(Number(price).toFixed(2)),
            optionProductId: accompanimentIdByName.get(norm(name)) ?? null,
          })),
        },
      },
      select: { id: true },
    })

    templateIds.push(template.id)
  }

  return templateIds
}

async function assignTemplatesToProducts(templateIds) {
  const products = await prisma.product.findMany({
    where: {
      category: { slug: 'frozen' },
    },
    select: { id: true, name: true },
  })

  const prioritized = products.filter((p) =>
    TARGET_PRODUCTS.some((name) => norm(name) === norm(p.name))
  )
  const missing = TARGET_PRODUCTS.filter(
    (name) => !prioritized.some((product) => norm(product.name) === norm(name))
  )

  for (const product of products) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        type: 'COMPOSED',
        selectionTitle: 'Escolha seus acompanhamentos',
        customizations: { deleteMany: {} },
        groupAssignments: {
          deleteMany: {},
          create: templateIds.map((groupTemplateId, index) => ({
            groupTemplateId,
            order: index,
          })),
        },
      },
    })
  }

  return { updatedCount: products.length, missing }
}

async function main() {
  const { accompanimentIdByName, created, updated } = await ensureAccompaniments()
  const templateIds = await upsertTemplates(accompanimentIdByName)
  const { updatedCount, missing } = await assignTemplatesToProducts(templateIds)

  console.log(`Acompanhamentos criados: ${created}`)
  console.log(`Acompanhamentos atualizados: ${updated}`)
  console.log(`Templates atualizados: ${templateIds.length}`)
  console.log(`Produtos Açaí Frozen atualizados: ${updatedCount}`)
  if (missing.length > 0) {
    console.log(`Produtos não encontrados: ${missing.join(' | ')}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
