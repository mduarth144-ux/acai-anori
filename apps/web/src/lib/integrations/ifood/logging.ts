type Level = 'info' | 'warn' | 'error'

export function logIntegration(
  level: Level,
  message: string,
  context: Record<string, unknown> = {}
) {
  const payload = {
    ts: new Date().toISOString(),
    source: 'ifood-integration',
    level,
    message,
    ...context,
  }
  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}
