import { NextResponse } from 'next/server'
import { processOutboxBatch } from '../../../../../lib/integrations/ifood/outbox'

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

  const data = await processOutboxBatch(25)
  return NextResponse.json({
    ok: true,
    ...data,
  })
}
