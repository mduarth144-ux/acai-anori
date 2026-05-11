/**
 * Executa o binário local do Vercel CLI com timeout e log de duração.
 * Evita a sensação de "travou para sempre" quando a API demora.
 *
 *   VERCEL_CMD_TIMEOUT_MS=120000  (default: 90000)
 */
import { spawnSync } from 'node:child_process'

/**
 * @param {{ root: string, vercelBin: string, argv: string[], label: string }} p
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
export function vercelSpawn({ root, vercelBin, argv, label }) {
  const timeoutMs = Number(process.env.VERCEL_CMD_TIMEOUT_MS || '90000')
  const started = Date.now()
  console.error(`[vercel] +${label} (timeout ${timeoutMs}ms)…`)
  const r = spawnSync(process.execPath, [vercelBin, ...argv], {
    cwd: root,
    encoding: 'utf8',
    // `inherit` no Windows pode deixar o processo do CLI pendurado após "Saving";
    // pipes + drenagem garantem que o spawnSync termina quando o filho sai.
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  const elapsed = Date.now() - started
  if (r.error?.code === 'ETIMEDOUT') {
    console.error(
      `[vercel] TIMEOUT após ${timeoutMs}ms — ${label}. Aumenta VERCEL_CMD_TIMEOUT_MS ou verifica rede / npx vercel whoami.`
    )
    process.exit(124)
  }
  console.error(`[vercel] −${label} (${elapsed}ms) exit=${r.status ?? 'null'}`)
  return r
}
