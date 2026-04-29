import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { enqueueOrderCreate, enqueueStatusUpdate } from '../../../lib/integrations/ifood/outbox'
import { isValidLocalTransition } from '../../../lib/integrations/ifood/status-map'
import { mergeIfoodRefs } from '../../../lib/integrations/ifood/external-refs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')?.trim()
  const email = searchParams.get('email')?.trim().toLowerCase()

  const where =
    phone || email
      ? {
          OR: [
            ...(phone ? [{ customerPhone: phone }] : []),
            ...(email ? [{ customerEmail: email }] : []),
          ],
        }
      : undefined

  const data = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
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
      customerEmail:
        typeof body.customerEmail === 'string' && body.customerEmail.trim().length > 0
          ? body.customerEmail.trim().toLowerCase()
          : null,
      address: body.address,
      notes: body.notes,
      tableId: table?.id,
      total: body.items.reduce(
        (
          acc: number,
          item: {
            unitPrice: number
            quantity: number
            choices?: Array<{ priceModifier?: number }>
          }
        ) =>
          acc +
          (item.unitPrice +
            (item.choices?.reduce(
              (sum, choice) => sum + Number(choice.priceModifier ?? 0),
              0
            ) ?? 0)) *
            item.quantity,
        0
      ),
      pixProvider: null,
      externalRefs: {
        integrationReady: { pix: true, ifood: true, food99: true },
        ifood: { syncState: 'pending', source: 'internal' },
      },
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

  await enqueueOrderCreate(created.id)

  return NextResponse.json(created)
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'id obrigatório' }, { status: 400 })
  const body = (await request.json()) as {
    status?: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'
    source?: 'INTERNAL' | 'IFOOD_WEBHOOK'
  }
  if (!body.status) {
    return NextResponse.json({ message: 'status obrigatório' }, { status: 400 })
  }

  const current = await prisma.order.findUnique({ where: { id } })
  if (!current) {
    return NextResponse.json({ message: 'pedido não encontrado' }, { status: 404 })
  }

  if (!isValidLocalTransition(current.status, body.status)) {
    return NextResponse.json(
      { message: `transição inválida de ${current.status} para ${body.status}` },
      { status: 409 }
    )
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: body.status,
      externalRefs: mergeIfoodRefs(current.externalRefs, {
        source: body.source === 'IFOOD_WEBHOOK' ? 'ifood-webhook' : 'internal',
        lastSyncAt: new Date().toISOString(),
      }),
    },
  })

  await enqueueStatusUpdate({
    orderId: id,
    status: body.status,
    source: body.source ?? 'INTERNAL',
  })

  return NextResponse.json(updated)
}
