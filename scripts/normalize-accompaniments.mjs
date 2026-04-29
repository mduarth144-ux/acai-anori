import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE === '1'

function vlog(message) {
  if (!VERBOSE) return
  console.log(`[${new Date().toISOString()}] ${message}`)
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const ALIAS_TO_CANONICAL = new Map([
  ['leite ninho e morango', 'Morango'],
  ['leite ninho e ouro branco', 'Ouro Branco'],
  ['nutella e sonho de valsa', 'Sonho De Valsa'],
  ['nutella kit kat e leite ninho', 'Kit Kat'],
])

const JUNK_NAMES = new Set([
  'acompanhamento reutilizavel para produtos compostos',
  'combinacao mix de sabores com acompanhamentos para montar do seu jeito',
  'popa de acai e agua mineral esterizado feito no rigoroso sistema de braqueamento 100% natural higienizado pasteurizado',
  'popa de acai e agua mineral esterizado feito no rigoroso sistema de braqueamento 100% natural higienizado pasteurizado venha se delicia o melhor acai da regiao',
  'venha se delicia o melhor acai da regiao',
  'versao especial com base premium; adicionais caros ficam opcionais para upgrade',
])

async function ensureCanonicalProducts() {
  const canonicalNames = [...new Set(ALIAS_TO_CANONICAL.values())]
  const canonicalIds = new Map()
  for (const name of canonicalNames) {
    const existing = await prisma.product.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!existing) continue
    canonicalIds.set(normalize(name), existing.id)
  }
  return canonicalIds
}

async function main() {
  const canonicalIds = await ensureCanonicalProducts()
  let remappedOptions = 0
  let removedOptions = 0
  let removedProducts = 0

  const aliasOptions = await prisma.customizationOption.findMany({
    where: {
      name: {
        in: [...ALIAS_TO_CANONICAL.keys()],
        mode: 'insensitive',
      },
    },
    select: { id: true, name: true },
  })

  for (const option of aliasOptions) {
    const canonicalName = ALIAS_TO_CANONICAL.get(normalize(option.name))
    if (!canonicalName) continue
    const targetId = canonicalIds.get(normalize(canonicalName))
    if (!targetId) continue
    await prisma.customizationOption.update({
      where: { id: option.id },
      data: {
        name: canonicalName,
        optionProductId: targetId,
      },
    })
    remappedOptions += 1
  }

  const junkOptions = await prisma.customizationOption.findMany({
    where: {
      OR: [
        {
          name: {
            in: [...JUNK_NAMES],
            mode: 'insensitive',
          },
        },
        {
          name: {
            in: [...ALIAS_TO_CANONICAL.keys()],
            mode: 'insensitive',
          },
        },
      ],
    },
    select: { id: true },
  })

  if (junkOptions.length > 0) {
    const { count } = await prisma.customizationOption.deleteMany({
      where: { id: { in: junkOptions.map((item) => item.id) } },
    })
    removedOptions += count
  }

  const junkProducts = await prisma.product.findMany({
    where: {
      type: 'ACCOMPANIMENT',
      OR: [
        {
          name: {
            in: [...JUNK_NAMES],
            mode: 'insensitive',
          },
        },
        {
          name: {
            in: [...ALIAS_TO_CANONICAL.keys()],
            mode: 'insensitive',
          },
        },
      ],
    },
    select: { id: true },
  })

  if (junkProducts.length > 0) {
    const { count } = await prisma.product.deleteMany({
      where: { id: { in: junkProducts.map((item) => item.id) } },
    })
    removedProducts += count
  }

  const totalAccompaniments = await prisma.product.count({ where: { type: 'ACCOMPANIMENT' } })
  vlog(`Opções remapeadas para canônico: ${remappedOptions}`)
  vlog(`Opções removidas (lixo/duplicadas): ${removedOptions}`)
  vlog(`Produtos acompanhamento removidos: ${removedProducts}`)
  console.log(
    `Normalização concluída. Remapeadas: ${remappedOptions}; opções removidas: ${removedOptions}; acompanhamentos removidos: ${removedProducts}; acompanhamentos ativos: ${totalAccompaniments}.`
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
