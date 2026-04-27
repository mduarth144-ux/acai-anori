import { NextResponse } from 'next/server'

/** Proxy reverso para Nominatim (evita CORS no browser e respeita User-Agent). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  if (!lat || !lng) {
    return NextResponse.json({ error: 'Informe lat e lng.' }, { status: 400 })
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'json')
  url.searchParams.set('lat', lat)
  url.searchParams.set('lon', lng)
  url.searchParams.set('accept-language', 'pt-BR')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'CardapioDigital/1.0 (cardapio-digital; endereco-entrega)',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Falha no geocoding.' }, { status: 502 })
  }

  const data = (await res.json()) as {
    address?: Record<string, string>
  }
  const addr = data.address ?? {}
  const rawCep = (addr.postcode ?? '').replace(/\D/g, '').slice(0, 8)
  const street =
    addr.road ?? addr.pedestrian ?? addr.path ?? addr.residential ?? ''
  const neighborhood =
    addr.suburb ??
    addr.neighbourhood ??
    addr.quarter ??
    addr.city_district ??
    addr.hamlet ??
    ''

  return NextResponse.json({
    street: String(street).trim(),
    neighborhood: String(neighborhood).trim(),
    cepDigits: rawCep.length === 8 ? rawCep : '',
  })
}
