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

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'id obrigatório' }, { status: 400 })

  const body = await request.json()
  const data = await prisma.category.update({
    where: { id },
    data: { name: body.name, slug: body.slug },
  })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'id obrigatório' }, { status: 400 })

  const linkedProducts = await prisma.product.count({ where: { categoryId: id } })
  if (linkedProducts > 0) {
    return NextResponse.json(
      {
        message:
          'Categoria possui produtos vinculados. Remova ou mova os produtos antes de excluir.',
      },
      { status: 409 }
    )
  }

  await prisma.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
