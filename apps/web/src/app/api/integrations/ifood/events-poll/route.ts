import { NextResponse } from 'next/server'
import { runIfoodEventsPollCycle } from '../../../../../lib/integrations/ifood/events-poll'

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

  const data = await runIfoodEventsPollCycle()
  return NextResponse.json({ ok: true, ...data })
}
