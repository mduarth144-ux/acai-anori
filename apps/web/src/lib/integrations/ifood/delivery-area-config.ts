import { prisma } from '../../prisma'

const CONFIG_KEY = 'ifood_delivery_area'

export type IfoodDeliveryAreaConfig = {
  city: string
  state: string
  defaultLatitude: number
  defaultLongitude: number
  allowedCities: string[]
  allowedNeighborhoods: string[]
}

function normalizeList(value: string[]): string[] {
  return value
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function fromUnknown(raw: unknown): IfoodDeliveryAreaConfig {
  const payload = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    city: String(payload.city ?? process.env.IFOOD_DELIVERY_CITY?.trim() ?? 'Manaus'),
    state: String(payload.state ?? process.env.IFOOD_DELIVERY_STATE?.trim() ?? 'AM'),
    defaultLatitude: Number(payload.defaultLatitude ?? process.env.IFOOD_DEFAULT_LATITUDE ?? '-3.1190275'),
    defaultLongitude: Number(payload.defaultLongitude ?? process.env.IFOOD_DEFAULT_LONGITUDE ?? '-60.0217314'),
    allowedCities: Array.isArray(payload.allowedCities)
      ? normalizeList(payload.allowedCities.map((item) => String(item)))
      : [],
    allowedNeighborhoods: Array.isArray(payload.allowedNeighborhoods)
      ? normalizeList(payload.allowedNeighborhoods.map((item) => String(item)))
      : [],
  }
}

export async function getIfoodDeliveryAreaConfig(): Promise<IfoodDeliveryAreaConfig> {
  const delegate = (prisma as unknown as {
    integrationConfig?: {
      findUnique: (...args: any[]) => Promise<{ value: unknown } | null>
    }
  }).integrationConfig

  if (!delegate) {
    return fromUnknown({})
  }

  const record = await delegate.findUnique({
    where: { key: CONFIG_KEY },
    select: { value: true },
  })
  return fromUnknown(record?.value)
}

export async function saveIfoodDeliveryAreaConfig(
  config: IfoodDeliveryAreaConfig
): Promise<IfoodDeliveryAreaConfig> {
  const payload = {
    city: config.city.trim(),
    state: config.state.trim().toUpperCase(),
    defaultLatitude: Number(config.defaultLatitude),
    defaultLongitude: Number(config.defaultLongitude),
    allowedCities: normalizeList(config.allowedCities),
    allowedNeighborhoods: normalizeList(config.allowedNeighborhoods),
  }

  const delegate = (prisma as unknown as {
    integrationConfig?: {
      upsert: (...args: any[]) => Promise<{ value: unknown }>
    }
  }).integrationConfig

  if (!delegate) {
    return fromUnknown(payload)
  }

  const result = await delegate.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: payload },
    update: { value: payload },
    select: { value: true },
  })

  return fromUnknown(result.value)
}
