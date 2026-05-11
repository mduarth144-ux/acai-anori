import { acknowledgeOrderEvents, pollOrderEvents } from './client'
import { logIntegration } from './logging'
import { processTrustedIfoodWebhookRawBody } from './webhook-processor'

function extractEventId(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null
  const id = (event as Record<string, unknown>).id
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null
}

/**
 * Um ciclo de polling + acknowledgment + tentativa de processar cada evento como webhook.
 * Configure um cron (ex.: a cada 30s) em POST /api/integrations/ifood/events-poll com segredo de job.
 */
export async function runIfoodEventsPollCycle(): Promise<{
  received: number
  acked: number
  processed: number
  failed: number
}> {
  const categories =
    process.env.IFOOD_EVENTS_POLLING_CATEGORIES?.trim() || 'FOOD,GROCERY'
  const events = await pollOrderEvents({ categories })
  if (events.length === 0) {
    return { received: 0, acked: 0, processed: 0, failed: 0 }
  }

  let processed = 0
  let failed = 0
  for (const ev of events) {
    try {
      const raw = JSON.stringify(ev)
      const result = await processTrustedIfoodWebhookRawBody(raw)
      if (result.ok && !result.deduplicated) {
        processed += 1
      }
      if (!result.ok) {
        failed += 1
        logIntegration('warn', 'Evento polling iFood nao aplicado ao pedido local', {
          message: result.message,
        })
      }
    } catch (error) {
      failed += 1
      logIntegration('warn', 'Falha ao processar evento do polling iFood', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const ids = events
    .map((ev) => extractEventId(ev))
    .filter((id): id is string => typeof id === 'string')
  if (ids.length > 0) {
    await acknowledgeOrderEvents(ids.map((id) => ({ id })))
  }

  logIntegration('info', 'Ciclo polling eventos iFood', {
    received: events.length,
    acked: ids.length,
    processed,
    failed,
  })

  return {
    received: events.length,
    acked: ids.length,
    processed,
    failed,
  }
}
