import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const IFOOD_WEBHOOK_SECRET = Deno.env.get('IFOOD_WEBHOOK_SECRET') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function sign(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder()
  return crypto.subtle
    .importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ])
    .then((key) => crypto.subtle.sign('HMAC', key, encoder.encode(body)))
    .then((sig) =>
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    )
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), { status: 405 })
  }

  if (!IFOOD_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ message: 'Webhook secret not configured' }), {
      status: 500,
    })
  }

  const rawBody = await request.text()
  const signatureHeader = request.headers.get('x-ifood-signature')?.replace(/^sha256=/i, '')
  if (!signatureHeader) {
    return new Response(JSON.stringify({ message: 'Missing signature' }), { status: 401 })
  }

  const expected = await sign(IFOOD_WEBHOOK_SECRET, rawBody)
  if (expected !== signatureHeader) {
    return new Response(JSON.stringify({ message: 'Invalid signature' }), { status: 401 })
  }

  const event = JSON.parse(rawBody)

  const { error } = await supabase.from('IfoodWebhookEvent').insert({
    eventId: event.eventId,
    eventType: event.eventType,
    merchantId: event.merchantId ?? null,
    ifoodOrderId: event.orderId ?? null,
    payload: event,
    payloadHash: expected,
    processingStatus: 'RECEIVED',
  })

  if (error) {
    return new Response(JSON.stringify({ message: 'Error persisting webhook', error: error.message }), {
      status: 500,
    })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
