import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE === '1'
const startedAt = Date.now()

function vlog(message) {
  if (!VERBOSE) return
  console.log(`[${new Date().toISOString()}] ${message}`)
}

const EXTRA_ACCOMPANIMENTS = [
  'Tapioca Crocante',
  'Aveia',
  'Flocos De Arroz',
  'Granola',
  'Jujuba',
  'Neston',
  'Amendoim Grande',
  'Paçoca',
  'Chocobol Grande',
  'Farinha Láctea',
  'Disquete Pequeno',
  'Disquete Grande',
  'Chocobol Pequeno',
  'Amendoim Triturado',
  'Leite Ninho',
  'Aveia Crocante',
  'Cereal De Banana',
  'Granola Completa',
  'Castanha De Caju',
  'Castanha Do Brasil',
  'Fruta Morango',
  'Fruta Kiwi',
  'Fruta Banana',
  'Bis',
  'Gotas De Chocolate',
  'Kit Kat',
  'Nutella',
  'Oreo Triturado',
  'Ouro Branco',
  'Sonho De Valsa',
  '1 Bola De Sorvete De Morango',
  '1 Bola De Sorvete De Chocolate',
  '1 Bola De Sorvete De Cupuaçu',
  'Brownie Tradicional',
  'Calda De Chocolate',
  'Calda De Leite Condensado',
  'Calda De Morango',
  'Calda De Banana',
  'Solicitado Talheres',
  'Não Solicito Talheres',
  'Deseja Os Acompanhamentos Separado',
]

const STOP_TOKENS = new Set([
  'acai',
  'açai',
  'acai frozen',
  'frozen',
  'delicioso',
  'monte do seu jeito',
  'monte do seu jeito.',
  'base premium',
  'adicionais caros ficam opcionais para upgrade.',
  'com',
  'e',
])

function normalize(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function toTitleCase(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isFrozenProduct(product) {
  const haystack = normalize(`${product.name} ${product.description ?? ''} ${product.category?.name ?? ''}`)
  return haystack.includes('frozen') || (haystack.includes('acai') && (/\b\d+\s?(ml|l)\b/.test(haystack) || haystack.includes('litro') || haystack.includes('pote')))
}

function extractAccompanimentsFromDescription(description) {
  if (!description) return []
  const parts = String(description)
    .replace(/[().]/g, ' ')
    .split(/[+,/|\n]/g)
    .map((part) => toTitleCase(part))
    .filter(Boolean)

  return parts.filter((item) => !STOP_TOKENS.has(normalize(item)))
}

async function findProductByNameInsensitive(name) {
  return prisma.product.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
    },
  })
}

async function ensureAccompanimentProducts(names) {
  vlog(`Garantindo acompanhamentos: ${names.length} nomes candidatos.`)
  const category = await prisma.category.upsert({
    where: { slug: 'acompanhamentos' },
    update: { name: 'Acompanhamentos' },
    create: { slug: 'acompanhamentos', name: 'Acompanhamentos', order: 999 },
  })

  const accompanimentIds = []
  let createdCount = 0
  let updatedCount = 0
  for (const rawName of names) {
    const name = toTitleCase(rawName)
    if (!name) continue
    const existing = await findProductByNameInsensitive(name)
    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            type: 'ACCOMPANIMENT',
            categoryId: category.id,
            price: 1,
            available: true,
          },
        })
      : await prisma.product.create({
          data: {
            name,
            description: 'Acompanhamento reutilizável para produtos compostos.',
            price: 1,
            available: true,
            type: 'ACCOMPANIMENT',
            categoryId: category.id,
          },
        })
    if (existing) updatedCount += 1
    else createdCount += 1
    accompanimentIds.push(product.id)
  }

  vlog(`Acompanhamentos processados: criados=${createdCount}, atualizados=${updatedCount}.`)

  return accompanimentIds
}

async function main() {
  vlog('Iniciando sincronização de Frozen e acompanhamentos.')
  const products = await prisma.product.findMany({
    include: { category: true },
  })
  vlog(`Produtos carregados: ${products.length}.`)

  const frozenProducts = products.filter(isFrozenProduct)
  vlog(`Produtos Frozen identificados: ${frozenProducts.length}.`)
  const extracted = new Set()
  for (const product of frozenProducts) {
    for (const item of extractAccompanimentsFromDescription(product.description)) {
      extracted.add(item)
    }
  }
  for (const item of EXTRA_ACCOMPANIMENTS) extracted.add(item)
  vlog(`Acompanhamentos extraídos+base: ${extracted.size}.`)

  const accompanimentIds = await ensureAccompanimentProducts([...extracted])
  const accompanimentProducts = await prisma.product.findMany({
    where: { id: { in: accompanimentIds } },
    orderBy: { name: 'asc' },
  })

  const simpleOptions = accompanimentProducts.map((item) => ({
    optionProductId: item.id,
    name: item.name,
    priceModifier: 0,
  }))
  const premiumOptions = accompanimentProducts.map((item) => ({
    optionProductId: item.id,
    name: item.name,
    priceModifier: 1,
  }))

  let composedUpdated = 0
  for (const product of frozenProducts) {
    vlog(`Atualizando produto composto: ${product.name}`)
    await prisma.product.update({
      where: { id: product.id },
      data: {
        type: 'COMPOSED',
        selectionTitle: 'ESCOLHA UM ACOMPANHAMENTO',
        customizations: {
          deleteMany: {},
          create: [
            {
              label: 'Simples',
              required: false,
              minSelect: 0,
              maxSelect: 2,
              affectsPrice: false,
              freeQuantity: 2,
              options: { create: simpleOptions },
            },
            {
              label: 'Especiais',
              required: false,
              minSelect: 0,
              maxSelect: 5,
              affectsPrice: true,
              freeQuantity: 0,
              options: { create: premiumOptions },
            },
          ],
        },
      },
    })
    composedUpdated += 1
  }

  const otherNonAccompaniments = products
    .filter((product) => !frozenProducts.some((frozen) => frozen.id === product.id))
    .filter((product) => product.type !== 'ACCOMPANIMENT')

  for (const product of otherNonAccompaniments) {
    await prisma.product.update({
      where: { id: product.id },
      data: { type: 'FINAL', selectionTitle: null },
    })
  }

  console.log(
    `Sincronização concluída. Frozen compostos: ${composedUpdated}. Acompanhamentos ativos: ${accompanimentProducts.length}. Outros produtos ajustados para FINAL: ${otherNonAccompaniments.length}. Tempo: ${Math.round((Date.now() - startedAt) / 1000)}s.`
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
