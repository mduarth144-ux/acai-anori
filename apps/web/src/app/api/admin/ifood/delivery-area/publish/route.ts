import { NextResponse } from 'next/server'
import { getIfoodEnv } from '../../../../../../lib/integrations/ifood/env'
import {
  getIfoodDeliveryAreaConfig,
  saveIfoodDeliveryAreaConfig,
} from '../../../../../../lib/integrations/ifood/delivery-area-config'
import { publishIfoodDeliveryArea } from '../../../../../../lib/integrations/ifood/client'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    city?: string
    state?: string
    defaultLatitude?: number
    defaultLongitude?: number
    radiusKm?: number
    allowedCities?: string[]
    allowedNeighborhoods?: string[]
  }

  const current = await getIfoodDeliveryAreaConfig()
  const nextConfig = {
    city: String(body.city ?? current.city).trim(),
    state: String(body.state ?? current.state).trim().toUpperCase(),
    defaultLatitude: Number(body.defaultLatitude ?? current.defaultLatitude),
    defaultLongitude: Number(body.defaultLongitude ?? current.defaultLongitude),
    radiusKm: Number(body.radiusKm ?? current.radiusKm),
    allowedCities: Array.isArray(body.allowedCities) ? body.allowedCities : current.allowedCities,
    allowedNeighborhoods: Array.isArray(body.allowedNeighborhoods)
      ? body.allowedNeighborhoods
      : current.allowedNeighborhoods,
  }

  if (!nextConfig.city || !nextConfig.state) {
    return NextResponse.json({ message: 'Cidade e UF sao obrigatorias.' }, { status: 400 })
  }

  const env = getIfoodEnv()

  try {
    const published = await publishIfoodDeliveryArea({
      merchantId: env.merchantId,
      city: nextConfig.city,
      state: nextConfig.state,
      latitude: nextConfig.defaultLatitude,
      longitude: nextConfig.defaultLongitude,
      radiusKm: nextConfig.radiusKm,
      allowedNeighborhoods: nextConfig.allowedNeighborhoods,
    })

    const saved = await saveIfoodDeliveryAreaConfig(nextConfig)

    return NextResponse.json({
      ok: true,
      config: saved,
      published,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao publicar area de entrega no iFood'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
