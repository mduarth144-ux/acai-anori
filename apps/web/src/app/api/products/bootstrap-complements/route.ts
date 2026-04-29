import { NextResponse } from 'next/server'
import {
  bootstrapSandwichComplements,
  bootstrapTopFrozenProducts,
  bootstrapVolumeComplements,
} from '../../../../lib/product-relations-bootstrap'
import { prisma } from '../../../../lib/prisma'

export async function POST() {
  const [sandwich, volume, topFrozen] = await Promise.all([
    bootstrapSandwichComplements(prisma),
    bootstrapVolumeComplements(prisma),
    bootstrapTopFrozenProducts(prisma),
  ])
  return NextResponse.json({ sandwich, volume, topFrozen })
}
