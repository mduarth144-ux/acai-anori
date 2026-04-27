/**
 * Envia apps/web/public/catalog/*.jpg para Supabase Storage (bucket `catalog`).
 * Requer no .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Cria apps/web/public/catalog/storage-urls.json com mapa ficheiro → URL pública
 * para o seed usar miniaturas hospedadas.
 *
 * Uso: node --env-file=.env scripts/upload-catalog-to-supabase.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const catalogDir = path.join(root, 'apps', 'web', 'public', 'catalog')
const BUCKET = 'catalog'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some((b) => b.name === BUCKET)) return
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5242880,
  })
  if (error && !String(error.message).includes('already')) {
    console.error('createBucket:', error.message)
    console.error('Crie o bucket "catalog" como público no painel Supabase → Storage.')
    process.exit(1)
  }
}

function publicUrl(objectPath) {
  const base = url.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${BUCKET}/${objectPath}`
}

async function main() {
  await ensureBucket()

  const files = fs
    .readdirSync(catalogDir)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.'))

  const map = {}

  for (const file of files) {
    const full = path.join(catalogDir, file)
    const body = fs.readFileSync(full)
    const objectPath = file
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, body, {
      contentType: file.endsWith('.png') ? 'image/png' : 'image/jpeg',
      upsert: true,
    })
    if (error) {
      console.error('Upload falhou', file, error.message)
      process.exitCode = 1
      continue
    }
    map[file] = publicUrl(objectPath)
    console.log('upload', file)
  }

  const out = path.join(catalogDir, 'storage-urls.json')
  fs.writeFileSync(out, JSON.stringify({ bucket: BUCKET, urls: map }, null, 2))
  console.log('Escrito', out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
