/**
 * Cardápio Açaí Frozen de Anori — varejo (açaí, frozen, conveniência, cervejas).
 * Miniaturas: ficheiros em /public/catalog (ver scripts/download-catalog-images.mjs).
 * Se existir catalog/storage-urls.json (após upload Supabase), usa URL pública.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEED_MARKER = '[anori-seed]'

function loadCatalogUrls(): Record<string, string> {
  try {
    const p = path.join(__dirname, '../apps/web/public/catalog/storage-urls.json')
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8')) as { urls?: Record<string, string> }
      return j.urls ?? {}
    }
  } catch {
    /* ignore */
  }
  return {}
}

function img(file: string, urls: Record<string, string>): string {
  return urls[file] ?? `/catalog/${file}`
}

/** Coberturas e grãos — variações do mesmo tipo de produto açaí. */
const COBERTURAS = {
  label: 'Cobertura / complemento (até 3 na loja)',
  required: false,
  options: [
    { name: 'Granola', priceModifier: 0 },
    { name: 'Castanha de caju', priceModifier: 3 },
    { name: 'Leite em pó', priceModifier: 2 },
    { name: 'Farinha láctea', priceModifier: 2 },
    { name: 'Leite condensado', priceModifier: 2 },
    { name: 'Paçoca', priceModifier: 2 },
    { name: 'Nutella', priceModifier: 4 },
    { name: 'Morango fresco', priceModifier: 3 },
  ],
}

const BOLAS_SORVETE = {
  label: 'Bolas de sorvete (adicional)',
  required: false,
  options: [
    { name: 'Sem bola extra', priceModifier: 0 },
    { name: '+1 bola', priceModifier: 3.5 },
    { name: '+2 bolas', priceModifier: 6 },
  ],
}

type CustomBlock = {
  label: string
  required: boolean
  options: Array<{ name: string; priceModifier: number }>
}

type ProductSeed = {
  name: string
  description: string
  price: number
  imageFile: string
  order: number
  categorySlug: string
  customizations?: CustomBlock[]
}

async function main() {
  const urls = loadCatalogUrls()

  await prisma.product.deleteMany({
    where: { description: { contains: SEED_MARKER } },
  })

  const catAcai = await prisma.category.upsert({
    where: { slug: 'acai' },
    update: {
      name: 'Açaí',
      order: 0,
      imageUrl: img('acai-tigela-granola.jpg', urls),
    },
    create: {
      name: 'Açaí',
      slug: 'acai',
      order: 0,
      imageUrl: img('acai-tigela-granola.jpg', urls),
    },
  })

  const catFrozen = await prisma.category.upsert({
    where: { slug: 'acai-frozen' },
    update: {
      name: 'Açaí frozen e sorvetes',
      order: 1,
      imageUrl: img('sorvete-casquinha.jpg', urls),
    },
    create: {
      name: 'Açaí frozen e sorvetes',
      slug: 'acai-frozen',
      order: 1,
      imageUrl: img('sorvete-casquinha.jpg', urls),
    },
  })

  const catConv = await prisma.category.upsert({
    where: { slug: 'conveniencia' },
    update: {
      name: 'Conveniência',
      order: 2,
      imageUrl: img('refrigerante-lata.jpg', urls),
    },
    create: {
      name: 'Conveniência',
      slug: 'conveniencia',
      order: 2,
      imageUrl: img('refrigerante-lata.jpg', urls),
    },
  })

  const catCerveja = await prisma.category.upsert({
    where: { slug: 'cervejas' },
    update: {
      name: 'Cervejas',
      order: 3,
      imageUrl: img('cerveja-lata.jpg', urls),
    },
    create: {
      name: 'Cervejas',
      slug: 'cervejas',
      order: 3,
      imageUrl: img('cerveja-lata.jpg', urls),
    },
  })

  const catBySlug: Record<string, { id: string }> = {
    acai: catAcai,
    'acai-frozen': catFrozen,
    conveniencia: catConv,
    cervejas: catCerveja,
  }

  const products: ProductSeed[] = [
    // —— 10 açaís: ml, taça/garrafa/tigela + mesmas variações de cobertura e bolas ——
    {
      name: 'Açaí 300ml — taça P',
      description: `${SEED_MARKER} Porção individual; creme de açaí Anori.`,
      price: 14.9,
      imageFile: 'copo-smoothie-tampa.jpg',
      order: 0,
      categorySlug: 'acai',
      customizations: [COBERTURAS, BOLAS_SORVETE],
    },
    {
      name: 'Açaí 400ml — taça M',
      description: `${SEED_MARKER} Tigela média; combine coberturas.`,
      price: 17.9,
      imageFile: 'acai-tigela-granola.jpg',
      order: 1,
      categorySlug: 'acai',
      customizations: [COBERTURAS, BOLAS_SORVETE],
    },
    {
      name: 'Açaí 500ml — taça G',
      description: `${SEED_MARKER} Tigela grande para matar a fome.`,
      price: 21.9,
      imageFile: 'tigela-frutas-tropical.jpg',
      order: 2,
      categorySlug: 'acai',
      customizations: [COBERTURAS, BOLAS_SORVETE],
    },
    {
      name: 'Açaí 250ml — garrafa PET',
      description: `${SEED_MARKER} Para levar; ideal com QR da mesa.`,
      price: 11.5,
      imageFile: 'acai-garrafa-pet.jpg',
      order: 3,
      categorySlug: 'acai',
      customizations: [COBERTURAS],
    },
    {
      name: 'Açaí 500ml — garrafa PET',
      description: `${SEED_MARKER} Garrafa meio litro; shake espesso.`,
      price: 16.9,
      imageFile: 'garrafa-plastico-roxa.jpg',
      order: 4,
      categorySlug: 'acai',
      customizations: [COBERTURAS],
    },
    {
      name: 'Açaí 1L — garrafa retornável',
      description: `${SEED_MARKER} Família ou longa sessão de trabalho.`,
      price: 28.9,
      imageFile: 'smoothie-roxo-garrafa.jpg',
      order: 5,
      categorySlug: 'acai',
      customizations: [COBERTURAS, BOLAS_SORVETE],
    },
    {
      name: 'Açaí 700ml — tigela descartável',
      description: `${SEED_MARKER} Delivery e retirada; tampa inclusa onde aplicável.`,
      price: 24.9,
      imageFile: 'acai-tigela-premium.jpg',
      order: 6,
      categorySlug: 'acai',
      customizations: [COBERTURAS, BOLAS_SORVETE],
    },
    {
      name: 'Açaí 350ml — copo térmico',
      description: `${SEED_MARKER} Mantém temperatura na ida.`,
      price: 15.5,
      imageFile: 'smoothie-frutas-vermelhas.jpg',
      order: 7,
      categorySlug: 'acai',
      customizations: [COBERTURAS],
    },
    {
      name: 'Açaí 600ml — pote delivery',
      description: `${SEED_MARKER} Embalagem firme para motoboy.`,
      price: 22.9,
      imageFile: 'acai-tigela-granola.jpg',
      order: 8,
      categorySlug: 'acai',
      customizations: [COBERTURAS, BOLAS_SORVETE],
    },
    {
      name: 'Açaí 800ml — tigela família',
      description: `${SEED_MARKER} Dividir na mesa; Anori varejo.`,
      price: 32.9,
      imageFile: 'tigela-frutas-tropical.jpg',
      order: 9,
      categorySlug: 'acai',
      customizations: [COBERTURAS, BOLAS_SORVETE],
    },

    // —— 10 frozen / sorvete ——
    {
      name: 'Açaí frozen 200ml — morango',
      description: `${SEED_MARKER} Textura gelato; morango.`,
      price: 11.9,
      imageFile: 'frozen-morango-copo.jpg',
      order: 0,
      categorySlug: 'acai-frozen',
    },
    {
      name: 'Açaí frozen 300ml — mix berries',
      description: `${SEED_MARKER} Frutas vermelhas.`,
      price: 14.9,
      imageFile: 'sorvete-copo-bolas.jpg',
      order: 1,
      categorySlug: 'acai-frozen',
      customizations: [COBERTURAS],
    },
    {
      name: 'Açaí frozen 400ml — cupuaçu',
      description: `${SEED_MARKER} Sabor amazônico.`,
      price: 17.5,
      imageFile: 'gelato-colher.jpg',
      order: 2,
      categorySlug: 'acai-frozen',
    },
    {
      name: 'Milk-shake de açaí 400ml',
      description: `${SEED_MARKER} Batido com leite; calda opcional na loja.`,
      price: 16.9,
      imageFile: 'milkshake-copo.jpg',
      order: 3,
      categorySlug: 'acai-frozen',
    },
    {
      name: 'Sundae 2 bolas + calda',
      description: `${SEED_MARKER} Taça sobremesa; escolha de calda no balcão.`,
      price: 13.9,
      imageFile: 'sundae-calda.jpg',
      order: 4,
      categorySlug: 'acai-frozen',
      customizations: [BOLAS_SORVETE],
    },
    {
      name: 'Casquinha — 1 bola',
      description: `${SEED_MARKER} Sabor do dia consulte o balcão.`,
      price: 8.5,
      imageFile: 'sorvete-casquinha.jpg',
      order: 5,
      categorySlug: 'acai-frozen',
    },
    {
      name: 'Casquinha — 2 bolas',
      description: `${SEED_MARKER} Mais cremoso.`,
      price: 11,
      imageFile: 'sorvete-casquinha.jpg',
      order: 6,
      categorySlug: 'acai-frozen',
    },
    {
      name: 'Pote 500ml — 3 sabores',
      description: `${SEED_MARKER} Açaí frozen + combinações.`,
      price: 19.9,
      imageFile: 'sorvete-pote.jpg',
      order: 7,
      categorySlug: 'acai-frozen',
      customizations: [COBERTURAS],
    },
    {
      name: 'Waffle com sorvete',
      description: `${SEED_MARKER} Waffle quente + bola dupla.`,
      price: 18.5,
      imageFile: 'waffle-sorvete.jpg',
      order: 8,
      categorySlug: 'acai-frozen',
    },
    {
      name: 'Milk-shake 500ml — ovomaltine (estilo)',
      description: `${SEED_MARKER} Malte + açaí; cobertura crocante na loja.`,
      price: 19.9,
      imageFile: 'milkshake-copo.jpg',
      order: 9,
      categorySlug: 'acai-frozen',
    },

    // —— 15 conveniência ——
    {
      name: 'Refrigerante cola — lata 350ml',
      description: `${SEED_MARKER} Bebida gelada.`,
      price: 6.5,
      imageFile: 'refrigerante-lata.jpg',
      order: 0,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Refrigerante cola — PET 1L',
      description: `${SEED_MARKER} Garrafa retornável onde aplicável.`,
      price: 9.9,
      imageFile: 'refrigerante-garrafa.jpg',
      order: 1,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Refrigerante limão — PET 2L',
      description: `${SEED_MARKER} Citrus gelado.`,
      price: 11.5,
      imageFile: 'refrigerante-lata-limao.jpg',
      order: 2,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Água mineral — 500ml',
      description: `${SEED_MARKER} Sem gás.`,
      price: 3.5,
      imageFile: 'agua-mineral.jpg',
      order: 3,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Suco natural — laranja 300ml',
      description: `${SEED_MARKER} Outros sabores na loja.`,
      price: 7.9,
      imageFile: 'suco-laranja.jpg',
      order: 4,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Energético — lata',
      description: `${SEED_MARKER} Marca conforme estoque.`,
      price: 12.9,
      imageFile: 'energetico-lata.jpg',
      order: 5,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Bolacha recheada — pacote',
      description: `${SEED_MARKER} Sabores variados.`,
      price: 4.5,
      imageFile: 'bolachas-biscoitos.jpg',
      order: 6,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Biscoito cream cracker',
      description: `${SEED_MARKER} Pacote individual.`,
      price: 3.9,
      imageFile: 'biscoito-cream-cracker.jpg',
      order: 7,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Biscoito água e sal',
      description: `${SEED_MARKER} Tradicional.`,
      price: 3.5,
      imageFile: 'biscoito-recheado.jpg',
      order: 8,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Chocolate ao leite — barra',
      description: `${SEED_MARKER} Snack rápido.`,
      price: 5.9,
      imageFile: 'chocolate-barra.jpg',
      order: 9,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Salgadinho — chips',
      description: `${SEED_MARKER} Pacote médio.`,
      price: 7.5,
      imageFile: 'salgadinho-batata.jpg',
      order: 10,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Salgadinho — torradinho',
      description: `${SEED_MARKER} Crocante.`,
      price: 4.9,
      imageFile: 'salgadinho-torradinho.jpg',
      order: 11,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Balas sortidas — pacote',
      description: `${SEED_MARKER} Doces de balcão.`,
      price: 3,
      imageFile: 'balas-doces.jpg',
      order: 12,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Iogurte natural — 170g',
      description: `${SEED_MARKER} Gelado.`,
      price: 4.9,
      imageFile: 'iogurte-grega.jpg',
      order: 13,
      categorySlug: 'conveniencia',
    },
    {
      name: 'Pipoca doce — sachê',
      description: `${SEED_MARKER} Cinema em casa.`,
      price: 3.5,
      imageFile: 'pipoca.jpg',
      order: 14,
      categorySlug: 'conveniencia',
    },

    // —— 5 cervejas (exemplos de varejo) ——
    {
      name: 'Cerveja Budweiser — long neck 330ml',
      description: `${SEED_MARKER} Beba com moderação. +18.`,
      price: 6.9,
      imageFile: 'cerveja-longneck.jpg',
      order: 0,
      categorySlug: 'cervejas',
    },
    {
      name: 'Cerveja Skol — lata 350ml',
      description: `${SEED_MARKER} Beba com moderação. +18.`,
      price: 5.5,
      imageFile: 'cerveja-lata.jpg',
      order: 1,
      categorySlug: 'cervejas',
    },
    {
      name: 'Cerveja Antarctica — lata 350ml',
      description: `${SEED_MARKER} Beba com moderação. +18.`,
      price: 5.5,
      imageFile: 'cerveja-lata.jpg',
      order: 2,
      categorySlug: 'cervejas',
    },
    {
      name: 'Cerveja Brahma — lata 350ml',
      description: `${SEED_MARKER} Beba com moderação. +18.`,
      price: 5.5,
      imageFile: 'cerveja-lata.jpg',
      order: 3,
      categorySlug: 'cervejas',
    },
    {
      name: 'Cerveja Amstel — lata 350ml',
      description: `${SEED_MARKER} Beba com moderação. +18.`,
      price: 5.9,
      imageFile: 'cerveja-lata.jpg',
      order: 4,
      categorySlug: 'cervejas',
    },
  ]

  for (const p of products) {
    const cat = catBySlug[p.categorySlug]
    if (!cat) continue
    const { imageFile, customizations, categorySlug: _c, ...rest } = p
    await prisma.product.create({
      data: {
        ...rest,
        imageUrl: img(imageFile, urls),
        categoryId: cat.id,
        customizations: customizations
          ? {
              create: customizations.map((c) => ({
                label: c.label,
                required: c.required,
                options: { create: c.options },
              })),
            }
          : undefined,
      },
    })
  }

  for (let n = 1; n <= 12; n++) {
    await prisma.table.upsert({
      where: { number: n },
      update: { active: true, code: `mesa-${n}` },
      create: { number: n, code: `mesa-${n}`, active: true },
    })
  }

  console.log(
    `Seed Anori: ${products.length} produtos (10 açaí + 10 frozen + 15 conveniência + 5 cervejas), mesas 1–12. Imagens: storage-urls.json ou /catalog/.`
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
