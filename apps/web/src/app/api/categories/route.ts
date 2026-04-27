import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET() {
  const data = await prisma.category.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const data = await prisma.category.create({ data: { name: body.name, slug: body.slug } })
  return NextResponse.json(data)
}
