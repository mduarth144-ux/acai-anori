import { NextResponse } from 'next/server'
import {
  getIfoodDeliveryAreaConfig,
  saveIfoodDeliveryAreaConfig,
} from '../../../../../lib/integrations/ifood/delivery-area-config'

export async function GET() {
  const config = await getIfoodDeliveryAreaConfig()
  return NextResponse.json({ ok: true, config })
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    city?: string
    state?: string
    defaultLatitude?: number
    defaultLongitude?: number
    radiusKm?: number
    allowedCities?: string[]
    allowedNeighborhoods?: string[]
  }

  if (!body.city?.trim() || !body.state?.trim()) {
    return NextResponse.json({ message: 'city e state sao obrigatorios' }, { status: 400 })
  }

  const saved = await saveIfoodDeliveryAreaConfig({
    city: body.city,
    state: body.state,
    defaultLatitude: Number(body.defaultLatitude),
    defaultLongitude: Number(body.defaultLongitude),
    radiusKm: Number(body.radiusKm),
    allowedCities: Array.isArray(body.allowedCities) ? body.allowedCities : [],
    allowedNeighborhoods: Array.isArray(body.allowedNeighborhoods) ? body.allowedNeighborhoods : [],
  })

  return NextResponse.json({ ok: true, config: saved })
}
