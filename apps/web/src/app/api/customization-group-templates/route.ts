import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET() {
  const templates = await prisma.customizationGroupTemplate.findMany({
    include: {
      options: {
        include: { optionProduct: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      },
    },
    orderBy: [{ name: 'asc' }],
  })

  return NextResponse.json(
    templates.map((template) => ({
      ...template,
      options: template.options.map((option) => ({
        ...option,
        priceModifier: Number(option.priceModifier),
        optionProduct: option.optionProduct
          ? { ...option.optionProduct, price: Number(option.optionProduct.price) }
          : null,
      })),
    }))
  )
}
