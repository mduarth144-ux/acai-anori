import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    cep?: string
    address?: string
    city?: string
    state?: string
  }

  const cep = String(body.cep ?? '').replace(/\D/g, '')
  const city = String(body.city ?? '').trim()
  const state = String(body.state ?? '').trim()
  const address = String(body.address ?? '').trim()

  if (!address && cep.length !== 8) {
    return NextResponse.json(
      { message: 'Informe um CEP valido ou um endereco para buscar no mapa.' },
      { status: 400 }
    )
  }

  let query = address
  if (!query && cep.length === 8) {
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      next: { revalidate: 0 },
    })
    if (!viaCepResponse.ok) {
      return NextResponse.json({ message: 'Falha ao consultar ViaCEP.' }, { status: 502 })
    }
    const viaCep = (await viaCepResponse.json()) as {
      erro?: boolean
      logradouro?: string
      bairro?: string
      localidade?: string
      uf?: string
    }
    if (viaCep.erro) {
      return NextResponse.json({ message: 'CEP nao encontrado.' }, { status: 404 })
    }
    query = [viaCep.logradouro, viaCep.bairro, viaCep.localidade, viaCep.uf, cep, 'Brasil']
      .filter(Boolean)
      .join(', ')
  }

  const locationQuery = [query, city, state].filter(Boolean).join(', ')
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('q', locationQuery)

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'CardapioDigital/1.0 (cardapio-digital; admin-delivery-geocode)',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    return NextResponse.json({ message: 'Falha ao geocodificar endereco.' }, { status: 502 })
  }

  const data = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
  const first = data[0]
  const latitude = Number(first?.lat)
  const longitude = Number(first?.lon)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ message: 'Nao foi possivel localizar esse endereco.' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    latitude,
    longitude,
    displayName: first?.display_name ?? locationQuery,
  })
}
