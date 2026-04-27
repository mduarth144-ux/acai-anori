// Script de seed: limpa banco e popula com produtos da Anori Açaí Frozen (iFood)
import { PrismaClient } from '@prisma/client'
import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

const PUBLIC_DIR = join(__dirname, '../apps/web/public/products')
const BASE_IMG = 'https://static.ifood-static.com.br/image/upload/t_high/pratos/ed87c07e-ec0e-4102-af58-73a1ce2b85b9/'

function downloadImage(filename) {
  const url = `${BASE_IMG}${filename}`
  const localPath = join(PUBLIC_DIR, filename)
  return new Promise((resolve, reject) => {
    if (existsSync(localPath)) { console.log(`  ✓ já existe: ${filename}`); return resolve(`/products/${filename}`) }
    const file = createWriteStream(localPath)
    https.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); return reject(new Error(`HTTP ${res.statusCode} para ${url}`)) }
      res.pipe(file)
      file.on('finish', () => { file.close(); console.log(`  ↓ baixado: ${filename}`); resolve(`/products/${filename}`) })
    }).on('error', (err) => { file.close(); reject(err) })
  })
}

// Dados extraídos diretamente do HTML da página do iFood
const catalog = [
  {
    name: 'Açaí de Litro Natural',
    slug: 'acai-litro-natural',
    order: 1,
    products: [
      {
        name: 'Açaí (Grosso médio) - 1 Litro Puro (não adoçado) garrafinha',
        description: 'Poupa de açaí e água mineral esterilizado feito no rigoroso sistema de branqueamento. 100% natural higienizado pasteurizado. Venha se deliciar com o açaí da região. Serve 3 pessoas.',
        price: 30.00,
        order: 1,
        imgFile: '202303311242_i6Iq_.jpeg',
      },
      {
        name: 'Açaí (Grosso médio) - 1 Litro puro (não adoçado) saco',
        description: 'Popa de açaí e água mineral esterilizado feito no rigoroso sistema de branqueamento. 100% natural higienizado pasteurizado. Venha se deliciar com o melhor açaí da região. Serve 2 pessoas.',
        price: 29.00,
        order: 2,
        imgFile: '202010141759_XoOg_.jpeg',
      },
    ],
  },
  {
    name: 'Açaí Frozen Tradicional',
    slug: 'acai-frozen-tradicional',
    order: 2,
    products: [
      {
        name: 'Copo de 330ml',
        description: 'Delicioso Açaí Frozen. Monte do seu jeito. Serve 1 pessoa.',
        price: 23.00,
        order: 1,
        imgFile: '202012132153_67sK_.jpeg',
      },
      {
        name: 'Pote de 350ml',
        description: 'Delicioso Açaí Frozen. Monte do seu jeito. Serve 1 pessoa.',
        price: 24.00,
        order: 2,
        imgFile: '202007232358_kqjJ_i.jpg',
      },
      {
        name: 'Copo de 440ml',
        description: 'Delicioso Açaí Frozen. Monte do seu jeito. Serve 1 pessoa.',
        price: 26.00,
        order: 3,
        imgFile: '202010011723_1QKU_i.jpg',
      },
      {
        name: 'Pote de 550ml',
        description: 'Delicioso Açaí Frozen. Monte do seu jeito. Serve 1 pessoa.',
        price: 27.00,
        order: 4,
        imgFile: '202007240007_uoOi_i.jpg',
      },
      {
        name: 'Pote de 750ml',
        description: 'Delicioso Açaí Frozen. Monte do seu jeito. Serve 2 pessoas.',
        price: 36.00,
        order: 5,
        imgFile: '202012132208_mwEJ_.jpeg',
      },
      {
        name: '2 potes de 500ml',
        description: '5 acompanhamentos e 3 opcional gratuitos. Serve 2 pessoas.',
        price: 52.00,
        order: 6,
        imgFile: '202309131451_A3QO_.jpeg',
      },
      {
        name: '2 potes de 440ml',
        description: 'Escolha até 4 acompanhamentos da sua preferência em cada pote. Serve 2 pessoas.',
        price: 50.00,
        order: 7,
        imgFile: '202401291556_KqyM_.jpeg',
      },
    ],
  },
  {
    name: 'Açaí Frozen Especial',
    slug: 'acai-frozen-especial',
    order: 3,
    products: [
      {
        name: 'Açaí Especial Ouro Branco 400ml',
        description: 'Delicioso Açaí Frozen. Leite Moça, Nutella, Leite Ninho e Ouro Branco. Serve 1 pessoa.',
        price: 35.00,
        order: 1,
        imgFile: '202209152356_G236_i.jpg',
      },
      {
        name: 'Açaí Frozen Especial Kit Kat 400ml',
        description: 'Delicioso Açaí Frozen. Leite Moça, Nutella, Leite Ninho e Kit Kat. Serve 1 pessoa.',
        price: 35.00,
        order: 2,
        imgFile: '202209132350_3VH3_i.jpg',
      },
      {
        name: 'Açaí Especial Morango 400ml',
        description: 'Delicioso Açaí Frozen. Leite Moça, Nutella, Leite Ninho e Morango. Serve 1 pessoa.',
        price: 35.00,
        order: 3,
        imgFile: '202209160004_Q2VQ_i.jpg',
      },
      {
        name: 'Açaí Especial Sonho de Valsa 400ml',
        description: 'Delicioso Açaí Frozen. Leite Moça, Nutella, Leite Ninho e Sonho de Valsa. Serve 1 pessoa.',
        price: 35.00,
        order: 4,
        imgFile: '202209140003_1KNS_i.jpg',
      },
    ],
  },
  {
    name: 'Bebidas',
    slug: 'bebidas',
    order: 4,
    products: [
      {
        name: 'Coca-Cola 350ml',
        description: 'Bebida gelada.',
        price: 6.00,
        order: 1,
        imgFile: '202201081658_X0C6_i.jpg',
      },
    ],
  },
]

async function main() {
  console.log('\n📁 Criando diretório de imagens...')
  mkdirSync(PUBLIC_DIR, { recursive: true })

  // Baixar todas as imagens
  console.log('\n🖼️  Baixando imagens do iFood CDN...')
  const imgMap = {}
  for (const cat of catalog) {
    for (const p of cat.products) {
      imgMap[p.imgFile] = await downloadImage(p.imgFile)
    }
  }

  // Limpar banco (ordem importa por FKs)
  console.log('\n🗑️  Limpando dados existentes...')
  await prisma.orderItem.deleteMany()
  console.log('  ✓ OrderItems removidos')
  await prisma.order.deleteMany()
  console.log('  ✓ Orders removidos')
  await prisma.customizationOption.deleteMany()
  await prisma.productCustomization.deleteMany()
  await prisma.product.deleteMany()
  console.log('  ✓ Produtos removidos')
  await prisma.category.deleteMany()
  console.log('  ✓ Categorias removidas')

  // Criar categorias e produtos
  console.log('\n🌿 Criando categorias e produtos...')
  for (const cat of catalog) {
    const category = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        order: cat.order,
        products: {
          create: cat.products.map((p) => ({
            name: p.name,
            description: p.description,
            price: p.price,
            order: p.order,
            available: true,
            imageUrl: imgMap[p.imgFile],
          })),
        },
      },
      include: { products: true },
    })
    console.log(`  ✓ ${category.name} (${category.products.length} produtos)`)
  }

  const totalProdutos = catalog.reduce((acc, c) => acc + c.products.length, 0)
  console.log(`\n✅ Seed concluído! ${catalog.length} categorias, ${totalProdutos} produtos.\n`)
}

main()
  .catch((e) => { console.error('\n❌ Erro:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
