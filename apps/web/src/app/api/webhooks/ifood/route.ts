import { NextResponse } from 'next/server'
import { validateIfoodSignature } from '../../../../lib/integrations/ifood/webhook-security'
import { processTrustedIfoodWebhookRawBody, type IfoodWebhookHttpEcho } from '../../../../lib/integrations/ifood/webhook-processor'

function errorResponse(status: number, message: string, ifood?: IfoodWebhookHttpEcho) {
  return NextResponse.json({ message, error: message, ...(ifood ? { ifood } : {}) }, { status })
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
    return errorResponse(result.status, result.message, result.ifood)
  }
  if (result.deduplicated) {
    return NextResponse.json({ ok: true, deduplicated: true, ifood: result.ifood })
  }
  return NextResponse.json({ ok: true, ifood: result.ifood })
}
