import { NextResponse } from 'next/server'
import { bootstrapSandwichComplements } from '../../../../lib/product-relations-bootstrap'
import { prisma } from '../../../../lib/prisma'

export async function POST() {
  const result = await bootstrapSandwichComplements(prisma)
  return NextResponse.json(result)
}
