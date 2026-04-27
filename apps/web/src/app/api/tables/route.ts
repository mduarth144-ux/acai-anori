import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { prisma } from '../../../lib/prisma'

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const data = await prisma.table.findMany({ orderBy: { number: 'asc' } })

  const withQrs = await Promise.all(
    data.map(async (table) => ({
      ...table,
      qrUrl: await QRCode.toDataURL(`${base}/mesa/${table.code}`),
    }))
  )

  return NextResponse.json(withQrs)
}

export async function POST(request: Request) {
  const body = await request.json()
  const number = Number(body.number)
  const code = `mesa-${number}`
  const created = await prisma.table.upsert({
    where: { number },
    update: { active: true },
    create: { number, code, active: true },
  })

  return NextResponse.json(created)
}
