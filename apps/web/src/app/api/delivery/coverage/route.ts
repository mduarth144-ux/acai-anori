import { NextResponse } from 'next/server'
import { validateDeliveryCoverage } from '../../../../lib/integrations/ifood/delivery-coverage'

export async function POST(request: Request) {
  const body = (await request.json()) as {
    cep?: string
    street?: string
    number?: string
    neighborhood?: string
  }

  const cep = String(body.cep ?? '').replace(/\D/g, '')
  const street = String(body.street ?? '').trim()
  const number = String(body.number ?? '').trim()
  const neighborhood = String(body.neighborhood ?? '').trim()

  if (cep.length !== 8 || !street || !number || !neighborhood) {
    return NextResponse.json(
      {
        message: 'Informe CEP, rua, numero e bairro para validar cobertura.',
      },
      { status: 400 }
    )
  }

  const coverage = await validateDeliveryCoverage({
    cep,
    street,
    number,
    neighborhood,
  })

  return NextResponse.json({
    ok: true,
    ...coverage,
  })
}
