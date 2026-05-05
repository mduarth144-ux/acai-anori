import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { enqueueStatusUpdate } from '../../../../../lib/integrations/ifood/outbox'

function isAuthorized(request: Request): boolean {
  const sharedSecret = process.env.INTERNAL_JOB_SECRET?.trim()
  const cronSecret = process.env.CRON_SECRET?.trim()
  const validSecrets = [sharedSecret, cronSecret].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
  if (!validSecrets.length) return true

  const provided = request.headers.get('x-job-secret')?.trim()
  if (provided && validSecrets.includes(provided)) return true

  const authHeader = request.headers.get('authorization')?.trim()
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return false

  const bearerToken = authHeader.slice(7).trim()
  return validSecrets.includes(bearerToken)
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
