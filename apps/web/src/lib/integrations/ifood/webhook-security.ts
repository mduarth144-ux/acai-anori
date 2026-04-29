import { createHmac, timingSafeEqual } from 'node:crypto'

export function signIfoodPayload(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

export function validateIfoodSignature(params: {
  secret: string
  rawBody: string
  signatureHeader: string | null
}): boolean {
  if (!params.signatureHeader) return false
  const expected = signIfoodPayload(params.secret, params.rawBody)
  const provided = params.signatureHeader.replace(/^sha256=/i, '')

  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}
