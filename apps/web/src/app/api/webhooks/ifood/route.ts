import { NextResponse } from 'next/server'
import { validateIfoodSignature } from '../../../../lib/integrations/ifood/webhook-security'
import { processTrustedIfoodWebhookRawBody } from '../../../../lib/integrations/ifood/webhook-processor'

function errorResponse(status: number, message: string) {
  return NextResponse.json({ message, error: message }, { status })
}

export async function POST(request: Request) {
  const secret = process.env.IFOOD_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return errorResponse(500, 'ifood webhook secret missing')
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-ifood-signature')
  const validSignature = validateIfoodSignature({
    secret,
    rawBody,
    signatureHeader: signature,
  })

  if (!validSignature) {
    return errorResponse(401, 'invalid signature')
  }

  const result = await processTrustedIfoodWebhookRawBody(rawBody)
  if (!result.ok) {
    return errorResponse(result.status, result.message)
  }
  if (result.deduplicated) {
    return NextResponse.json({ ok: true, deduplicated: true })
  }
  return NextResponse.json({ ok: true })
}
