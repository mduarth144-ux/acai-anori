import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL não está definida. Em produção (Vercel), adicione em Settings → Environment Variables.'
    )
  }
  return new PrismaClient({
    log: ['error', 'warn'],
  })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
