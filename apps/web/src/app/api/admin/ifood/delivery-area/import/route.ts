import { NextResponse } from 'next/server'
import {
  getIfoodDeliveryArea,
  getIfoodMerchantDetails,
} from '../../../../../../lib/integrations/ifood/client'
import {
  getIfoodDeliveryAreaConfig,
  saveIfoodDeliveryAreaConfig,
  type IfoodDeliveryAreaConfig,
} from '../../../../../../lib/integrations/ifood/delivery-area-config'
import { getIfoodEnv } from '../../../../../../lib/integrations/ifood/env'

type AddressHints = {
  cep?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function pickTextCandidates(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function extractDeliveryAreaPatch(raw: Record<string, unknown>): Partial<IfoodDeliveryAreaConfig> {
  const root = raw
  const center =
    (raw.center && typeof raw.center === 'object' ? (raw.center as Record<string, unknown>) : null) ??
    (raw.coordinates && typeof raw.coordinates === 'object'
      ? (raw.coordinates as Record<string, unknown>)
      : null)

  const latitude =
    toNumber(root.defaultLatitude) ??
    toNumber(root.latitude) ??
    toNumber(center?.latitude) ??
    toNumber(center?.lat)
  const longitude =
    toNumber(root.defaultLongitude) ??
    toNumber(root.longitude) ??
    toNumber(center?.longitude) ??
    toNumber(center?.lng)

  const radiusKm = toNumber(root.radiusKm) ?? toNumber(root.radius) ?? toNumber(root.maxDistanceKm)
  const cities = pickTextCandidates(root.allowedCities).concat(pickTextCandidates(root.cities))
  const neighborhoods = pickTextCandidates(root.allowedNeighborhoods).concat(
    pickTextCandidates(root.neighborhoods)
  )

  return {
    city: typeof root.city === 'string' ? root.city : undefined,
    state: typeof root.state === 'string' ? root.state : undefined,
    defaultLatitude: latitude ?? undefined,
    defaultLongitude: longitude ?? undefined,
    radiusKm: radiusKm ?? undefined,
    allowedCities: cities.length ? cities : undefined,
    allowedNeighborhoods: neighborhoods.length ? neighborhoods : undefined,
  }
}

function extractMerchantAddressPatch(raw: Record<string, unknown>): Partial<IfoodDeliveryAreaConfig> {
  const address =
    raw.address && typeof raw.address === 'object' ? (raw.address as Record<string, unknown>) : {}

  const latitude = toNumber(address.latitude)
  const longitude = toNumber(address.longitude)
  const city = typeof address.city === 'string' ? address.city.trim() : ''
  const state = typeof address.state === 'string' ? address.state.trim() : ''
  const district = typeof address.district === 'string' ? address.district.trim() : ''

  return {
    city: city || undefined,
    state: state || undefined,
    defaultLatitude: latitude ?? undefined,
    defaultLongitude: longitude ?? undefined,
    allowedNeighborhoods: district ? [district] : undefined,
  }
}

function extractMerchantAddressHints(raw: Record<string, unknown>): AddressHints {
  const address =
    raw.address && typeof raw.address === 'object' ? (raw.address as Record<string, unknown>) : {}

  return {
    cep: typeof address.postalCode === 'string' ? address.postalCode : undefined,
    street: typeof address.street === 'string' ? address.street : undefined,
    number: typeof address.number === 'string' ? address.number : undefined,
    neighborhood: typeof address.district === 'string' ? address.district : undefined,
    city: typeof address.city === 'string' ? address.city : undefined,
    state: typeof address.state === 'string' ? address.state : undefined,
  }
}

export async function GET() {
  const current = await getIfoodDeliveryAreaConfig()
  try {
    const env = getIfoodEnv()
    const remote = await getIfoodDeliveryArea({ merchantId: env.merchantId })
    const patch = extractDeliveryAreaPatch(remote)

    const merged: IfoodDeliveryAreaConfig = {
      ...current,
      ...patch,
      allowedCities: patch.allowedCities ?? current.allowedCities,
      allowedNeighborhoods: patch.allowedNeighborhoods ?? current.allowedNeighborhoods,
    }
    const saved = await saveIfoodDeliveryAreaConfig(merged)

    return NextResponse.json({
      ok: true,
      config: saved,
      importedFromIfood: patch,
      addressHints: {},
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar configuracao no iFood'
    const unsupportedRoute = message.includes('Nao foi possivel localizar endpoint de area de entrega no iFood')
    if (unsupportedRoute) {
      try {
        const env = getIfoodEnv()
        const merchant = await getIfoodMerchantDetails({ merchantId: env.merchantId })
        const patch = extractMerchantAddressPatch(merchant)
        const merged: IfoodDeliveryAreaConfig = {
          ...current,
          ...patch,
          allowedCities: patch.city ? [patch.city] : current.allowedCities,
          allowedNeighborhoods: patch.allowedNeighborhoods ?? current.allowedNeighborhoods,
        }
        const saved = await saveIfoodDeliveryAreaConfig(merged)

        return NextResponse.json({
          ok: true,
          config: saved,
          importedFromIfood: patch,
          addressHints: extractMerchantAddressHints(merchant),
          warning:
            'iFood nao expoe endpoint de coverage nesta conta; configuracao foi preenchida com endereco cadastral da loja no iFood.',
        })
      } catch (merchantError) {
        const merchantMessage =
          merchantError instanceof Error
            ? merchantError.message
            : 'Falha ao consultar dados cadastrais da loja no iFood'
        return NextResponse.json({
          ok: true,
          config: current,
          importedFromIfood: {},
          addressHints: {},
          warning:
            'Sua conta iFood nao disponibiliza endpoint de area de cobertura para importacao automatica. Mantendo configuracao local.',
          details: `${message} | ${merchantMessage}`,
        })
      }
    }
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
