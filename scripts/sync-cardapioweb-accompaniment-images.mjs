import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'apps', 'web', 'public', 'products', 'ifood', 'acompanhamentos')

const prisma = new PrismaClient()

const IMAGE_SOURCES = [
  {
    name: 'Leite condensado',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090542/thumb_8adb5b94leite_condensado.jpeg',
  },
  {
    name: 'Calda de chocolate',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090543/thumb_a0e50dc7cchocolate.png',
  },
  {
    name: 'Calda de morango',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090545/thumb_c7dde228cmorango.png',
  },
  {
    name: 'Calda de banana',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090535/thumb_b347a2c2cbanana.png',
  },
  {
    name: 'Tapioca crocante',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090512/thumb_1cb86bf1tapioca.jpeg',
  },
  {
    name: 'Granola',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090514/thumb_2eb6fd85granola.jpeg',
  },
  {
    name: 'Amendoim granulado',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090516/thumb_e0a0a9e3amenoin_granulado.jpeg',
  },
  {
    name: 'Amendoim em banda',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090540/thumb_b122275aamendoin_em_banda.png',
  },
  {
    name: 'Flocos de arroz',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090547/thumb_a10350bdflocos_de_arroz.png',
  },
  {
    name: 'M&M',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090549/thumb_bf54377am_m.jpeg',
  },
  {
    name: 'Chocoball',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090556/thumb_cc22d2fbchocoball.jpg',
  },
  {
    name: 'Sucrilhos',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090576/thumb_5dd81db1sucrilhios.png',
  },
  {
    name: 'Jujuba',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090577/thumb_bfc9b460jujuba.png',
  },
  {
    name: 'Leite Ninho',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090489/thumb_64c6f882leite_ninho.jpg',
  },
  {
    name: 'Ovomaltine',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090491/thumb_d234c626ovomaltine.png',
  },
  {
    name: 'Morango Fruta',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090531/thumb_6ae4e153morango.jpg',
  },
  {
    name: 'Banana fruta',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090537/thumb_a91cff72banana.jpg',
  },
  {
    name: 'Farinha Láctea',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090521/thumb_4be85728flactea.jpg',
  },
  {
    name: 'Bis',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090523/thumb_8644591cbis.png',
  },
  {
    name: 'Paçoca',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/2090533/thumb_f850abdapa%C3%A7oca.jpg',
  },
  {
    name: 'Sonho de Valsa',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/4076659/thumb_a8375d8ec89bb7f4-ba11-487c-b4ec-f9ef1d798ba0.jpg',
  },
  {
    name: 'Ouro Branco',
    url: 'https://storage.googleapis.com/prod-cardapio-web/uploads/subitem/image/4076660/thumb_757c0a10158ebf20-9524-48b0-b29a-6f80b3ec8fa5.jpg',
  },
]

const NAME_ALIASES = new Map([
  ['Farinha Láctea', ['Farinha Láctea- Barca e Roleta', 'Farinha Láctea']],
  ['Morango Fruta', ['Morango', 'Morango Fruta']],
  ['Banana fruta', ['Banana Fruta', 'Banana fruta']],
  ['Chocoball', ['Chocobol Grande', 'Chocobol Pequeno', 'Chocoball']],
  ['M&M', ['M&M', 'M e M']],
])

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extensionFromUrl(url) {
  const lower = url.toLowerCase()
  if (lower.includes('.png')) return '.png'
  if (lower.includes('.webp')) return '.webp'
  if (lower.includes('.gif')) return '.gif'
  if (lower.includes('.jpeg')) return '.jpeg'
  return '.jpg'
}

async function downloadImage(url, destAbsPath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const data = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(destAbsPath, data)
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  let downloaded = 0
  let dbUpdated = 0

  for (const entry of IMAGE_SOURCES) {
    const ext = extensionFromUrl(entry.url)
    const filename = `${slugify(entry.name)}${ext}`
    const absPath = path.join(outDir, filename)
    const relPath = `/products/ifood/acompanhamentos/${filename}`

    try {
      await downloadImage(entry.url, absPath)
      downloaded += 1
      console.log(`download ok: ${entry.name} -> ${filename}`)
    } catch (error) {
      console.warn(`download falhou: ${entry.name} (${entry.url}) -> ${error.message}`)
      continue
    }

    const aliases = NAME_ALIASES.get(entry.name) ?? [entry.name]
    for (const alias of aliases) {
      const result = await prisma.product.updateMany({
        where: {
          type: 'ACCOMPANIMENT',
          name: { equals: alias, mode: 'insensitive' },
        },
        data: { imageUrl: relPath },
      })
      if (result.count > 0) {
        dbUpdated += result.count
        console.log(`db update: ${alias} (${result.count})`)
      }
    }
  }

  console.log(`\nConcluído: ${downloaded} imagem(ns) baixada(s), ${dbUpdated} registro(s) atualizados no DB.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
