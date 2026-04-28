/**
 * Sincroniza categorias e produtos a partir do catálogo público do iFood (API marketplace).
 *
 * O HTML da página (Next.js) costuma vir com "menu": [] no __NEXT_DATA__ — o cardápio
 * é carregado no cliente. Este script usa o mesmo endpoint que o app móvel, com User-Agent
 * de iPhone, que em geral responde sem captcha.
 *
 * Uso:
 *   node --env-file=.env scripts/sync-ifood-menu.mjs "https://www.ifood.com.br/delivery/.../UUID"
 *   node --env-file=.env scripts/sync-ifood-menu.mjs --merchant 965ff627-2062-48b4-9ce6-848831f56370
 *   node --env-file=.env scripts/sync-ifood-menu.mjs --from-html ./pagina-ifood-salva.html
 *
 * Opções:
 *   --dry-run     só lista categorias/produtos, não grava no banco nem baixa imagens
 *   --no-images   importa sem baixar imagens (imageUrl aponta para CDN do iFood)
 *   --all-sections  inclui seções de marketing (bem-vindo, entrega grátis, favorito)
 *
 * Fluxo em produção (Vercel + Next/Image):
 *   1. Rode este script com imagens locais (sem --no-images) para popular apps/web/public/products/…
 *   2. npm run menu:upload-product-images — cria o bucket `products` no Supabase se faltar, envia os
 *      ficheiros e atualiza Product/Category.imageUrl para URLs públicas do Storage (já permitidas
 *      em next.config.js).
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import { PrismaClient } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const IFOOD_MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'

const CATALOG_URL = (merchantId) =>
  `https://cw-marketplace.ifood.com.br/v1/merchants/restaurant/${merchantId}/catalog`

const IMAGE_CDN = (logoPath) =>
  `https://static.ifood-static.com.br/image/upload/t_high/pratos/${logoPath}`

const DEFAULT_SKIP_CATEGORY = (name) => {
  const n = (name || '').trim().toLowerCase()
  if (/^bem vindos/.test(n)) return true
  if (n.includes('entrega grátis') || n.includes('entrega gratis')) return true
  if (/adicione/.test(n) && /favorito/.test(n)) return true
  return false
}

const FROZEN_ACCOMPANIMENT_MAP = [
  { regex: /\bkit[\s-]?kat\b/gi, label: 'KitKat' },
  { regex: /\bleite\s*ninho\b/gi, label: 'Leite Ninho' },
  { regex: /\bninho\b/gi, label: 'Leite Ninho' },
  { regex: /\bcastanha(?:s)?(?:\s+de\s+caju)?\b/gi, label: 'Castanha' },
  { regex: /\boreo\b/gi, label: 'Oreo' },
]

function normalizeFrozenBaseName(name) {
  let base = name
  for (const { regex } of FROZEN_ACCOMPANIMENT_MAP) {
    base = base.replace(regex, '')
  }
  return base
    .replace(/\b(c\/|com)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[-–|/]+$/g, '')
    .replace(/^[-–|/]+/g, '')
    .trim()
}

function detectFrozenAccompaniments(text) {
  const found = new Set()
  for (const item of FROZEN_ACCOMPANIMENT_MAP) {
    if (item.regex.test(text)) found.add(item.label)
    item.regex.lastIndex = 0
  }
  return Array.from(found)
}

function normalizeFrozenCategoryProducts(products) {
  const grouped = new Map()
  const passthrough = []

  for (const product of products) {
    const accompaniments = detectFrozenAccompaniments(
      `${product.name} ${product.description ?? ''}`
    )
    if (accompaniments.length === 0) {
      passthrough.push(product)
      continue
    }

    const baseName = normalizeFrozenBaseName(product.name)
    if (!baseName) {
      passthrough.push(product)
      continue
    }

    const key = `${baseName}::${product.price.toFixed(2)}`
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, {
        ...product,
        name: baseName,
        available: true,
        accompaniments: new Set(accompaniments),
      })
      continue
    }

    accompaniments.forEach((name) => existing.accompaniments.add(name))
    existing.available = existing.available || product.available
  }

  const mergedFrozen = Array.from(grouped.values()).map((product, idx) => ({
    ...product,
    order: idx,
    customizations: [
      {
        label: 'Acompanhamentos',
        required: true,
        options: Array.from(product.accompaniments)
          .sort((a, b) => a.localeCompare(b, 'pt-BR'))
          .map((name) => ({ name, priceModifier: 0 })),
      },
    ],
  }))

  const merged = [...mergedFrozen, ...passthrough].map((product, idx) => ({
    ...product,
    order: idx,
  }))

  return merged
}

function parseArgs(argv) {
  const out = { url: null, merchant: null, fromHtml: null, dryRun: false, noImages: false, allSections: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--no-images') out.noImages = true
    else if (a === '--all-sections') out.allSections = true
    else if (a === '--from-html' && argv[i + 1]) {
      out.fromHtml = argv[++i]
    } else if (a === '--merchant' && argv[i + 1]) {
      out.merchant = argv[++i]
    } else if (!a.startsWith('--') && !out.url) {
      out.url = a
    }
  }
  return out
}

function extractUuidFromString(s) {
  const m = String(s).match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  )
  return m ? m[0].toLowerCase() : null
}

function merchantIdFromUrl(url) {
  if (!url) return null
  const u = url.split('?')[0]
  const parts = u.split('/').filter(Boolean)
  const last = parts[parts.length - 1]
  return extractUuidFromString(last) || extractUuidFromString(u)
}

function merchantIdFromHtml(html) {
  const og =
    html.match(/property="og:url"[^>]+content="([^"]+)"/i) ||
    html.match(/content="(https:\/\/www\.ifood\.com\.br\/[^"]+)"[^>]*property="og:url"/i)
  if (og?.[1]) {
    const id = merchantIdFromUrl(og[1])
    if (id) return id
  }
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (next?.[1]) {
    try {
      const j = JSON.parse(next[1])
      const uuid =
        j?.props?.initialProps?.pageProps?.uuid ||
        j?.props?.pageProps?.uuid ||
        j?.query?.uuid
      if (uuid && extractUuidFromString(uuid)) return extractUuidFromString(uuid)
    } catch {
      /* ignore */
    }
  }
  return merchantIdFromUrl(html)
}

function slugify(name, used) {
  let base = (name || 'categoria')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/["'´`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'categoria'
  let slug = base
  let n = 2
  while (used.has(slug)) {
    slug = `${base}-${n++}`
  }
  used.add(slug)
  return slug
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': IFOOD_MOBILE_UA },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}\n${text.slice(0, 400)}`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Resposta não é JSON (possível bloqueio anti-bot). Início:\n${text.slice(0, 500)}`)
  }
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(destPath), { recursive: true })
    const file = createWriteStream(destPath)
    https
      .get(
        url,
        {
          headers: { 'User-Agent': IFOOD_MOBILE_UA },
        },
        (res) => {
          if (res.statusCode !== 200) {
            file.close()
            reject(new Error(`HTTP ${res.statusCode} para ${url}`))
            return
          }
          res.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
        }
      )
      .on('error', (err) => {
        file.close()
        reject(err)
      })
  })
}

const prisma = new PrismaClient()

async function main() {
  const args = parseArgs(process.argv)
  let merchantId = args.merchant
  if (args.fromHtml) {
    const html = readFileSync(args.fromHtml, 'utf8')
    merchantId = merchantIdFromHtml(html)
    if (!merchantId) {
      console.error('Não foi possível achar o UUID da loja no HTML (og:url ou __NEXT_DATA__).')
      process.exit(1)
    }
    console.log(`UUID extraído do HTML: ${merchantId}`)
  } else if (args.url) {
    merchantId = merchantIdFromUrl(args.url)
  }
  if (!merchantId) {
    console.error(
      'Informe uma URL do iFood, --merchant UUID ou --from-html arquivo.html\n' +
        'Ex.: node --env-file=.env scripts/sync-ifood-menu.mjs \"https://www.ifood.com.br/delivery/.../965ff627-...\"'
    )
    process.exit(1)
  }

  const catalogUrl = CATALOG_URL(merchantId)
  console.log(`Buscando catálogo: ${catalogUrl}`)
  const payload = await fetchJson(catalogUrl)
  if (payload.code !== '00' || !payload.data?.menu) {
    console.error('Formato de catálogo inesperado:', JSON.stringify(payload).slice(0, 500))
    process.exit(1)
  }

  const usedSlugs = new Set()
  const publicIfoodDir = join(ROOT, 'apps/web/public/products/ifood')
  const skipCat = args.allSections ? () => false : DEFAULT_SKIP_CATEGORY

  const categories = []
  for (let mi = 0; mi < payload.data.menu.length; mi++) {
    const section = payload.data.menu[mi]
    const sectionName = (section.name || '').trim()
    if (skipCat(sectionName)) {
      console.log(`  (ignorada seção: ${sectionName})`)
      continue
    }
    const itens = section.itens || section.items || []
    const products = []
    for (let pi = 0; pi < itens.length; pi++) {
      const item = itens[pi]
      const price = Number(item.unitPrice ?? item.unitMinPrice ?? 0)
      if (price < 0.05) continue
      const title = (item.description || '').trim()
      if (!title) continue
      const details = (item.details || '').trim()
      const logoPath = item.logoUrl
      let imageUrl = null
      if (logoPath && !args.noImages) {
        const cdn = IMAGE_CDN(logoPath)
        const fname = basename(logoPath.split('?')[0]) || `item-${pi}.jpg`
        const localRel = `/products/ifood/${fname}`
        const localAbs = join(publicIfoodDir, fname)
        if (!args.dryRun) {
          if (!existsSync(localAbs)) {
            try {
              await downloadToFile(cdn, localAbs)
              console.log(`  ↓ ${fname}`)
            } catch (e) {
              console.warn(`  ! imagem falhou (${fname}): ${e.message} — usando URL CDN`)
              imageUrl = cdn
            }
          }
          if (!imageUrl) imageUrl = localRel
        } else {
          imageUrl = localRel
        }
      } else if (logoPath && args.noImages) {
        imageUrl = IMAGE_CDN(logoPath)
      }
      products.push({
        name: title,
        description: details || null,
        price,
        order: products.length,
        available: item.enabled !== false && item.availability === 'AVAILABLE',
        imageUrl,
        customizations: [],
      })
    }
    if (products.length === 0) continue
    const isFrozenCategory = /a[çc]a[ií]\s*frozen/i.test(sectionName)
    categories.push({
      name: sectionName.replace(/\s+/g, ' ').trim(),
      slug: slugify(sectionName, usedSlugs),
      order: categories.length,
      imageUrl: products[0]?.imageUrl ?? null,
      products: isFrozenCategory
        ? normalizeFrozenCategoryProducts(products)
        : products,
    })
  }

  const totalProducts = categories.reduce((a, c) => a + c.products.length, 0)
  console.log(`\n${categories.length} categorias, ${totalProducts} produtos (após filtros).`)

  if (args.dryRun) {
    for (const c of categories) {
      console.log(`\n## ${c.name} (${c.products.length})`)
      for (const p of c.products.slice(0, 5)) {
        console.log(`  - ${p.name}  R$ ${p.price}`)
      }
      if (c.products.length > 5) console.log(`  ... +${c.products.length - 5}`)
    }
    return
  }

  console.log('\nLimpando pedidos e cardápio existentes...')
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.customizationOption.deleteMany()
  await prisma.productCustomization.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()

  console.log('Gravando categorias e produtos...\n')
  for (const cat of categories) {
    const row = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        order: cat.order,
        imageUrl: cat.imageUrl,
        products: {
          create: cat.products.map((p) => ({
            name: p.name,
            description: p.description,
            price: p.price,
            order: p.order,
            available: p.available,
            imageUrl: p.imageUrl,
            customizations: p.customizations?.length
              ? {
                  create: p.customizations.map((customization) => ({
                    label: customization.label,
                    required: customization.required,
                    options: {
                      create: customization.options.map((option) => ({
                        name: option.name,
                        priceModifier: option.priceModifier ?? 0,
                      })),
                    },
                  })),
                }
              : undefined,
          })),
        },
      },
      include: { products: true },
    })
    console.log(`  ✓ ${row.name} (${row.products.length} produtos)`)
  }

  console.log(`\nConcluído. ${categories.length} categorias, ${totalProducts} produtos.\n`)
}

main()
  .catch((e) => {
    console.error('\nErro:', e.message || e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
