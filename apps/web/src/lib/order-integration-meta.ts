import type { Prisma } from '@prisma/client'

/**
 * JSON em `Order.integrationMeta`: flags de integração (ex.: PIX futuro), confirmação de entrega pelo cliente, etc.
 * Não contém o estado iFood — isso fica em `Order.ifoodResponse`.
 */
export function mergeIntegrationMeta(
  current: unknown,
  patch: Record<string, Prisma.InputJsonValue>
): Prisma.InputJsonObject {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? ({ ...(current as Record<string, Prisma.InputJsonValue>) } as Record<string, Prisma.InputJsonValue>)
      : {}
  return { ...base, ...patch } as Prisma.InputJsonObject
}

export function mergeCustomerDeliveryConfirmation(currentMeta: unknown): Prisma.InputJsonObject {
  const base =
    currentMeta && typeof currentMeta === 'object' && !Array.isArray(currentMeta)
      ? { ...(currentMeta as Record<string, unknown>) }
      : {}
  const prevCustomer =
    base.customer && typeof base.customer === 'object' && !Array.isArray(base.customer)
      ? { ...(base.customer as Record<string, unknown>) }
      : {}
  return {
    ...base,
    customer: {
      ...prevCustomer,
      confirmedDelivery: true,
      confirmedDeliveryAt: new Date().toISOString(),
    },
  } as Prisma.InputJsonObject
}
