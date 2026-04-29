import { NextResponse } from 'next/server'
import {
  bootstrapSandwichComplements,
  bootstrapVolumeComplements,
} from '../../../../lib/product-relations-bootstrap'
import { prisma } from '../../../../lib/prisma'

export async function POST() {
  const [sandwich, volume] = await Promise.all([
    bootstrapSandwichComplements(prisma),
    bootstrapVolumeComplements(prisma),
  ])
  return NextResponse.json({ sandwich, volume })
}
