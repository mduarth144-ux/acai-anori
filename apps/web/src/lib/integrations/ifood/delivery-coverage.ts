import { getIfoodDeliveryAreaConfig } from './delivery-area-config'
import { getIfoodDeliveryAvailabilities } from './client'
import { getIfoodEnv } from './env'
import { getIfoodMerchantDetails } from './client'

type ValidateCoverageInput = {
  cep: string
  street: string
  number: string
  neighborhood: string
}

type GeocodedAddress = {
  postalCode: string
  streetName: string
  streetNumber: string
  neighborhood: string
  city: string
  state: string
  coordinates: {
    latitude: number
    longitude: number
  }
}

export type DeliveryCoverageResult = {
  withinCoverage: boolean
  reason?: string
  reasonCode?: string
  ifoodCode?: string | null
  distanceKm?: number
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function extractIfoodErrorCode(message: string): string | null {
  const match = message.match(/"code"\s*:\s*"([^"]+)"/)
  return match?.[1] ?? null
}

function mapIfoodAvailabilityError(code: string | null): {
  reasonCode: string
  reason: string
} {
  switch (code) {
    case 'DeliveryDistanceTooHigh':
    case 'ServiceAreaMismatch':
    case 'RegionMismatch':
      return {
        reasonCode: 'OUTSIDE_COVERAGE',
        reason: 'Endereco fora da area de cobertura do iFood para entrega.',
      }
    case 'UnavailableFleet':
    case 'NRELimitExceeded':
      return {
        reasonCode: 'NO_COURIERS_AVAILABLE',
        reason:
          'No momento nao ha entregadores disponiveis na sua regiao. Tente novamente em instantes.',
      }
    case 'MerchantStatusAvailability':
      return {
        reasonCode: 'MERCHANT_UNAVAILABLE',
        reason: 'A loja esta temporariamente indisponivel para entregas no iFood.',
      }
    default:
      return {
        reasonCode: 'IFOOD_AVAILABILITY_ERROR',
        reason: 'Nao foi possivel validar disponibilidade de entrega no iFood.',
      }
  }
}

function toRad(value: number) {
  return (value * Math.PI) / 180
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const arc = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc))
}

async function geocodeAddress(params: {
  postalCode: string
  streetName: string
  streetNumber: string
  neighborhood: string
  city: string
  state: string
}): Promise<{ latitude: number; longitude: number } | null> {
  const query = [
    params.streetName,
    params.streetNumber,
    params.neighborhood,
    params.city,
    params.state,
    params.postalCode,
    'Brasil',
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ')

  if (!query) return null

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('q', query)

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'CardapioDigital/1.0 (cardapio-digital; ifood-coverage-check)',
      },
      next: { revalidate: 0 },
    })
    if (!response.ok) return null

    const data = (await response.json()) as Array<{ lat?: string; lon?: string }>
    const first = data[0]
    const latitude = Number(first?.lat)
    const longitude = Number(first?.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return { latitude, longitude }
  } catch {
    return null
  }
}

export function parseDeliveryAddressText(address: string | null | undefined) {
  const lines = (address ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const postalCode = (lines[0]?.match(/\d{5}-?\d{3}/)?.[0] ?? '').replace(/\D/g, '')
  const streetLine = lines[1] ?? ''
  const [streetNameRaw, streetNumberRaw] = streetLine.split(',').map((part) => part?.trim() ?? '')

  return {
    cep: postalCode,
    street: streetNameRaw || '',
    number: streetNumberRaw || '',
    neighborhood: lines[2] || '',
  }
}

export async function validateDeliveryCoverage(
  input: ValidateCoverageInput
): Promise<DeliveryCoverageResult> {
  const config = await getIfoodDeliveryAreaConfig()
  let effectiveConfig = config
  try {
    const env = getIfoodEnv()
    const merchant = await getIfoodMerchantDetails({ merchantId: env.merchantId })
    const address =
      merchant.address && typeof merchant.address === 'object'
        ? (merchant.address as Record<string, unknown>)
        : {}
    const merchantCity = typeof address.city === 'string' ? address.city : ''
    const merchantState = typeof address.state === 'string' ? address.state : ''
    const merchantLat =
      typeof address.latitude === 'number' ? address.latitude : Number(address.latitude)
    const merchantLng =
      typeof address.longitude === 'number' ? address.longitude : Number(address.longitude)
    if (
      merchantCity &&
      merchantState &&
      Number.isFinite(merchantLat) &&
      Number.isFinite(merchantLng)
    ) {
      effectiveConfig = {
        ...config,
        city: merchantCity,
        state: merchantState,
        defaultLatitude: merchantLat,
        defaultLongitude: merchantLng,
      }
    }
  } catch {
    // keep local config when merchant endpoint is unavailable
  }
  const geocodedAddress: GeocodedAddress = {
    postalCode: input.cep.replace(/\D/g, ''),
    streetName: input.street.trim(),
    streetNumber: input.number.trim() || 'S/N',
    neighborhood: input.neighborhood.trim(),
    city: effectiveConfig.city,
    state: effectiveConfig.state,
    coordinates:
      (await geocodeAddress({
        postalCode: input.cep.replace(/\D/g, ''),
        streetName: input.street.trim(),
        streetNumber: input.number.trim() || 'S/N',
        neighborhood: input.neighborhood.trim(),
        city: effectiveConfig.city,
        state: effectiveConfig.state,
      })) ?? {
        latitude: effectiveConfig.defaultLatitude,
        longitude: effectiveConfig.defaultLongitude,
      },
  }

  const normalizedNeighborhood = normalizeText(geocodedAddress.neighborhood)
  const allowedNeighborhoods = new Set(effectiveConfig.allowedNeighborhoods.map(normalizeText))
  if (allowedNeighborhoods.size > 0 && !allowedNeighborhoods.has(normalizedNeighborhood)) {
    return {
      withinCoverage: false,
      reason: 'Bairro fora da area de entrega.',
      reasonCode: 'OUTSIDE_NEIGHBORHOOD_LIST',
    }
  }

  const distanceKm = haversineKm(
    {
      latitude: effectiveConfig.defaultLatitude,
      longitude: effectiveConfig.defaultLongitude,
    },
    geocodedAddress.coordinates
  )

  if (distanceKm > effectiveConfig.radiusKm) {
    return {
      withinCoverage: false,
      reason: `Endereco fora da area de entrega (limite ${effectiveConfig.radiusKm.toFixed(1)} km).`,
      reasonCode: 'OUTSIDE_RADIUS',
      distanceKm,
    }
  }

  try {
    const env = getIfoodEnv()
    const availabilities = await getIfoodDeliveryAvailabilities({
      merchantId: env.merchantId,
      latitude: geocodedAddress.coordinates.latitude,
      longitude: geocodedAddress.coordinates.longitude,
    })
    if (!availabilities[0]?.id) {
      return {
        withinCoverage: false,
        reason:
          'No momento nao ha entregadores disponiveis na sua regiao. Tente novamente em instantes.',
        reasonCode: 'NO_COURIERS_AVAILABLE',
        distanceKm,
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao consultar disponibilidade no iFood'
    const code = extractIfoodErrorCode(message)
    const mapped = mapIfoodAvailabilityError(code)
    return {
      withinCoverage: false,
      reason: mapped.reason,
      reasonCode: mapped.reasonCode,
      ifoodCode: code,
      distanceKm,
    }
  }

  return { withinCoverage: true, distanceKm }
}
