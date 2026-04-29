import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { enqueueStatusUpdate } from '../../../../../lib/integrations/ifood/outbox'

function isAuthorized(request: Request): boolean {
  const expected = process.env.INTERNAL_JOB_SECRET?.trim()
  if (!expected) return true
  const provided = request.headers.get('x-job-secret')?.trim()
  return provided === expected
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'],
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  let queued = 0
  for (const order of orders) {
    await enqueueStatusUpdate({
      orderId: order.id,
      status: order.status,
      source: 'INTERNAL',
    })
    queued += 1
  }

  return NextResponse.json({ ok: true, queued })
}
