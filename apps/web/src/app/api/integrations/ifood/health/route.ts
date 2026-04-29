import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function GET() {
  const [pendingOutbox, failedOutbox, failedWebhooks] = await Promise.all([
    prisma.integrationOutbox.count({ where: { status: 'PENDING' } }),
    prisma.integrationOutbox.count({ where: { status: 'FAILED' } }),
    prisma.ifoodWebhookEvent.count({ where: { processingStatus: 'FAILED' } }),
  ])

  return NextResponse.json({
    ok: true,
    pendingOutbox,
    failedOutbox,
    failedWebhooks,
    generatedAt: new Date().toISOString(),
  })
}
