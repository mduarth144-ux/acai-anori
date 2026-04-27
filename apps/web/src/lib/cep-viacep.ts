export type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export function onlyDigits(value: string, maxLen?: number): string {
  const d = value.replace(/\D/g, '')
  return maxLen != null ? d.slice(0, maxLen) : d
}

/** Exibe CEP como 00000-000 a partir de até 8 dígitos. */
export function formatCepDisplay(digits: string): string {
  const d = onlyDigits(digits, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export async function fetchViaCep(
  cepDigits: string
): Promise<ViaCepResponse | null> {
  if (cepDigits.length !== 8) return null
  const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
  if (!res.ok) return null
  const data = (await res.json()) as ViaCepResponse
  if (data.erro) return null
  return data
}

export function buildDeliveryAddressLine(parts: {
  cepDigits: string
  street: string
  number: string
  neighborhood: string
}): string {
  const cepFmt = formatCepDisplay(parts.cepDigits)
  const num = parts.number.trim() || 's/n'
  return [
    `CEP ${cepFmt}`,
    `${parts.street.trim()}, ${num}`,
    parts.neighborhood.trim(),
  ].join('\n')
}
