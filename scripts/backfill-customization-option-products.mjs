import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE === '1'
const startedAt = Date.now()

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

async function main() {
  vlog('Iniciando backfill de optionProductId.')
  const accompaniments = await prisma.product.findMany({
    where: { type: 'ACCOMPANIMENT' },
    select: { id: true, name: true },
  })

  const accompanimentByName = new Map()
  for (const item of accompaniments) {
    const key = normalize(item.name)
    if (!key || accompanimentByName.has(key)) continue
    accompanimentByName.set(key, item.id)
  }
  vlog(`Acompanhamentos indexados por nome: ${accompanimentByName.size}.`)

  const options = await prisma.customizationOption.findMany({
    where: { optionProductId: null },
    select: { id: true, name: true },
  })
  vlog(`Opções sem vínculo encontradas: ${options.length}.`)

  let updated = 0
  let unmatched = 0
  for (const option of options) {
    const matchedId = accompanimentByName.get(normalize(option.name))
    if (!matchedId) {
      unmatched += 1
      continue
    }
    await prisma.customizationOption.update({
      where: { id: option.id },
      data: { optionProductId: matchedId },
    })
    updated += 1
  }
  vlog(`Opções sem correspondência por nome: ${unmatched}.`)

  console.log(
    `Backfill concluido. Opções vinculadas: ${updated}. Sem correspondência: ${unmatched}. Tempo: ${Math.round((Date.now() - startedAt) / 1000)}s.`
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
