import { NextResponse } from 'next/server'
import { getIfoodDeliveryArea, getIfoodMerchantDetails } from '../../../../lib/integrations/ifood/client'
import { getIfoodDeliveryAreaConfig } from '../../../../lib/integrations/ifood/delivery-area-config'
import { getIfoodEnv } from '../../../../lib/integrations/ifood/env'

function extractAddressHints(raw: Record<string, unknown>) {
  const address =
    raw.address && typeof raw.address === 'object' ? (raw.address as Record<string, unknown>) : {}

  return {
    cep: typeof address.postalCode === 'string' ? address.postalCode : '',
    street: typeof address.street === 'string' ? address.street : '',
    number: typeof address.number === 'string' ? address.number : '',
    neighborhood: typeof address.district === 'string' ? address.district : '',
    city: typeof address.city === 'string' ? address.city : '',
    state: typeof address.state === 'string' ? address.state : '',
  }
}

export async function GET() {
  const current = await getIfoodDeliveryAreaConfig()
  try {
    const env = getIfoodEnv()
    let config = current
    try {
      const remoteCoverage = await getIfoodDeliveryArea({ merchantId: env.merchantId })
      const asObj = remoteCoverage as Record<string, unknown>
      const center =
        asObj.center && typeof asObj.center === 'object'
          ? (asObj.center as Record<string, unknown>)
          : asObj.coordinates && typeof asObj.coordinates === 'object'
            ? (asObj.coordinates as Record<string, unknown>)
            : {}
      const latitude =
        typeof asObj.latitude === 'number'
          ? asObj.latitude
          : typeof center.latitude === 'number'
            ? center.latitude
            : current.defaultLatitude
      const longitude =
        typeof asObj.longitude === 'number'
          ? asObj.longitude
          : typeof center.longitude === 'number'
            ? center.longitude
            : current.defaultLongitude
      config = {
        ...current,
        city: typeof asObj.city === 'string' ? asObj.city : current.city,
        state: typeof asObj.state === 'string' ? asObj.state : current.state,
        defaultLatitude: latitude,
        defaultLongitude: longitude,
      }
    } catch {
      // keep current and fallback to merchant details below
    }
    const merchant = await getIfoodMerchantDetails({ merchantId: env.merchantId })
    const hints = extractAddressHints(merchant)
    if (
      hints.city &&
      hints.state &&
      Number.isFinite(Number((merchant.address as Record<string, unknown> | undefined)?.latitude)) &&
      Number.isFinite(Number((merchant.address as Record<string, unknown> | undefined)?.longitude))
    ) {
      const address = merchant.address as Record<string, unknown>
      config = {
        ...config,
        city: hints.city,
        state: hints.state,
        defaultLatitude: Number(address.latitude),
        defaultLongitude: Number(address.longitude),
      }
    }
    return NextResponse.json({
      ok: true,
      config,
      addressHints: hints,
    })
  } catch {
    return NextResponse.json({
      ok: true,
      config: current,
      addressHints: null,
    })
  }
}
