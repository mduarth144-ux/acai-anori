/**
 * Envia imagens de apps/web/public/products/** para o bucket público `products` no Supabase
 * e atualiza Product.imageUrl e Category.imageUrl no Postgres quando a URL era relativa (/products/...).
 *
 * Pré-requisitos:
 *   - Arquivos já em public (ex.: npm run menu:sync-ifood com download de imagens)
 *   - .env na raiz: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 *
 * Uso: node --env-file=.env scripts/upload-product-images-to-supabase.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const productsPublicDir = path.join(root, 'apps', 'web', 'public', 'products')
const BUCKET = 'products'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const prisma = new PrismaClient()

function publicUrl(objectPath) {
  const base = url.replace(/\/$/, '')
  const key = objectPath.split(path.sep).join('/')
  return `${base}/storage/v1/object/public/${BUCKET}/${key}`
}

function contentType(file) {
  const lower = file.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some((b) => b.name === BUCKET)) return
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5242880,
  })
  if (error && !String(error.message).toLowerCase().includes('already')) {
    console.error('createBucket:', error.message)
    console.error(`Crie o bucket "${BUCKET}" como público no painel Supabase → Storage.`)
    process.exit(1)
  }
}

/** @returns {Generator<string>} */
function* walkImageFiles(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walkImageFiles(full)
    else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(e.name)) yield full
  }
}

async function main() {
  if (!fs.existsSync(productsPublicDir)) {
    console.error('Pasta inexistente:', productsPublicDir)
    console.error('Baixe imagens antes (ex.: npm run menu:sync-ifood sem --no-images).')
    process.exit(1)
  }

  await ensureBucket()

  /** @type {Record<string, string>} path relativo tipo "ifood/foo.jpg" -> URL pública */
  const uploaded = {}

  for (const abs of walkImageFiles(productsPublicDir)) {
    const rel = path.relative(productsPublicDir, abs)
    const objectKey = rel.split(path.sep).join('/')
    const body = fs.readFileSync(abs)
    const { error } = await supabase.storage.from(BUCKET).upload(objectKey, body, {
      contentType: contentType(abs),
      upsert: true,
    })
    if (error) {
      console.error('Upload falhou', objectKey, error.message)
      process.exitCode = 1
      continue
    }
    uploaded[objectKey] = publicUrl(objectKey)
    console.log('upload', objectKey)
  }

  if (Object.keys(uploaded).length === 0) {
    console.warn('Nenhuma imagem encontrada em', productsPublicDir)
    await prisma.$disconnect()
    return
  }

  const out = path.join(productsPublicDir, 'storage-urls.json')
  fs.writeFileSync(
    out,
    JSON.stringify({ bucket: BUCKET, urls: uploaded, basePath: '/products/' }, null, 2)
  )
  console.log('Mapa escrito', out)

  let productsUpdated = 0
  let categoriesUpdated = 0

  for (const [objectKey, supaUrl] of Object.entries(uploaded)) {
    const webPath = `/products/${objectKey}`
    const p = await prisma.product.updateMany({
      where: { imageUrl: webPath },
      data: { imageUrl: supaUrl },
    })
    const c = await prisma.category.updateMany({
      where: { imageUrl: webPath },
      data: { imageUrl: supaUrl },
    })
    productsUpdated += p.count
    categoriesUpdated += c.count
  }

  console.log(`\nPrisma: ${productsUpdated} produto(s), ${categoriesUpdated} categoria(s) com URL atualizada para o Storage.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
