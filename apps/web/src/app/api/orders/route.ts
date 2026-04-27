import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET() {
  const data = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const table = body.tableCode
    ? await prisma.table.findUnique({ where: { code: body.tableCode } })
    : null

  const created = await prisma.order.create({
    data: {
      status: 'PENDING',
      type: body.type,
      paymentMethod: body.paymentMethod,
      changeFor: body.changeFor,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      address: body.address,
      notes: body.notes,
      tableId: table?.id,
      total: body.items.reduce((acc: number, item: { unitPrice: number; quantity: number }) => acc + item.unitPrice * item.quantity, 0),
      pixProvider: null,
      externalRefs: { integrationReady: { pix: true, ifood: true, food99: true } },
      items: {
        create: body.items.map((item: { productId: string; quantity: number; unitPrice: number; notes?: string; choices?: unknown[] }) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
          choices: item.choices ?? [],
        })),
      },
    },
  })

  return NextResponse.json(created)
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'id obrigatório' }, { status: 400 })
  const body = await request.json()
  const updated = await prisma.order.update({ where: { id }, data: { status: body.status } })
  return NextResponse.json(updated)
}
