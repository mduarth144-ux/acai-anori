/**
 * Descarrega miniaturas para apps/web/public/catalog/
 * 1) Tenta URL Pixabay (CDN — ver https://pixabay.com/api/docs/ ; em produção hospedar no Supabase).
 * 2) Se falhar (ex.: 403 em CI), usa fallback Picsum só para ter ficheiro local.
 *
 * Uso: node scripts/download-catalog-images.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'apps', 'web', 'public', 'catalog')
const manifestPath = path.join(__dirname, 'catalog-images.manifest.json')

const pixabayHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://pixabay.com/',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
}

async function download(url) {
  const res = await fetch(url, { redirect: 'follow', headers: pixabayHeaders })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 500) return null
  return buf
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  fs.mkdirSync(outDir, { recursive: true })

  const report = []

  for (const row of manifest) {
    const dest = path.join(outDir, row.file)
    let source = 'pixabay'
    let buf = await download(row.pixabay)
    if (!buf) {
      source = 'picsum-fallback'
      const u = `https://picsum.photos/id/${row.picsumId}/640/640`
      const res = await fetch(u, { redirect: 'follow' })
      if (!res.ok) {
        console.error('Falhou tudo:', row.file)
        process.exitCode = 1
        continue
      }
      buf = Buffer.from(await res.arrayBuffer())
    }
    fs.writeFileSync(dest, buf)
    report.push({ file: row.file, source })
    console.log('OK', row.file, source)
  }

  fs.writeFileSync(
    path.join(outDir, 'download-report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), items: report }, null, 2)
  )

  fs.writeFileSync(
    path.join(outDir, 'ATTRIBUTION.md'),
    `# Imagens do catálogo (dev)

- **Pixabay**: URLs no manifest seguem o formato da API/CDN descrito em https://pixabay.com/api/docs/  
  Licença Pixabay Content License — em apps públicos, indique a origem quando exibir resultados.
- **Fallback Picsum**: usado só se o download Pixabay falhar; substitua por fotos reais do produto antes de produção.

Próximo passo: \`npm run catalog:upload\` para enviar estes ficheiros ao bucket Supabase e gerar \`storage-urls.json\`.
`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
