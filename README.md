# cardapio-facil

Aplicacao de cardapio digital com fluxo completo de pedido: vitrine de produtos, carrinho, checkout e acompanhamento de status.

## Stack

- Next.js + React
- Nx (monorepo/workspace)
- Prisma
- Supabase
- Tailwind CSS

## Requisitos

- Node.js 20+
- npm 10+

## Configuracao

1. Copie variaveis de ambiente:
   - `.env.example` -> `.env`
2. Preencha as chaves necessarias (banco, Supabase e integracoes).
3. Gere o client do Prisma:
   - `npm run prisma:generate`

## Scripts principais

- `npm run dev`: inicia o app web em desenvolvimento.
- `npm run build`: gera client Prisma e build de producao.
- `npm run lint`: executa lint do app web.
- `npm run format`: formata o projeto com Prettier.
- `npm run prisma:migrate`: roda migracoes em ambiente local.
- `npm run db:seed`: popula dados iniciais.
- `npm run menu:sync-ifood`: sincroniza cardapio a partir da integracao iFood.
- `npm run menu:upload-product-images`: sobe imagens de produtos para storage.

## Estrutura resumida

- `apps/web`: frontend principal.
- `prisma`: schema e seed.
- `scripts`: automacoes de sincronizacao e deploy.

## Observacoes

- O projeto usa menu inferior fixo e barras de acao fixas no rodape das telas de compra.
- Para deploy, utilize os scripts de integracao com Vercel ja definidos no `package.json`.
- Para prevenir regressao de acesso publico (ex.: `403 Forbidden` sem cookies/storage), rode `npm run vercel:preflight` apos cada deploy.
