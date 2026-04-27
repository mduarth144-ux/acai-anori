import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET() {
  const data = await prisma.product.findMany({ where: { available: true }, orderBy: { order: 'asc' } })
  return NextResponse.json(data.map((item) => ({ ...item, price: Number(item.price) })))
}

export async function POST(request: Request) {
  const body = await request.json()
  const data = await prisma.product.create({
    data: {
      name: body.name,
      price: body.price,
      categoryId: body.categoryId,
      available: true,
    },
  })
  return NextResponse.json({ ...data, price: Number(data.price) })
}
