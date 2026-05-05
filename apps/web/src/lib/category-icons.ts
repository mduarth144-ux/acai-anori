import type { LucideIcon } from 'lucide-react'
import {
  Apple,
  Beef,
  Candy,
  CupSoda,
  Drumstick,
  IceCreamCone,
  Leaf,
  Milk,
  PackagePlus,
  Pizza,
  Salad,
  Sandwich,
  ShoppingBasket,
  UtensilsCrossed,
} from 'lucide-react'

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  'acai-frozen': IceCreamCone,
  acai: IceCreamCone,
  acompanhamentos: Candy,
  adicionais: PackagePlus,
  bebidas: CupSoda,
  sucos: Apple,
  vitaminas: Milk,
  sobremesas: Candy,
  lanches: Sandwich,
  hamburgueres: Beef,
  pizzas: Pizza,
  saladas: Salad,
  pratos: UtensilsCrossed,
  refeicoes: UtensilsCrossed,
  frango: Drumstick,
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function getCategoryIcon(slug: string, name: string): LucideIcon {
  const normalizedSlug = normalize(slug)
  const normalizedName = normalize(name)

  if (ICON_BY_SLUG[normalizedSlug]) return ICON_BY_SLUG[normalizedSlug]

  if (normalizedName.includes('acai') || normalizedName.includes('frozen')) return IceCreamCone
  if (normalizedName.includes('acompanh') || normalizedName.includes('adicional')) return Candy
  if (normalizedName.includes('bebida') || normalizedName.includes('suco')) return CupSoda
  if (normalizedName.includes('fruta') || normalizedName.includes('natural')) return Leaf

  return ShoppingBasket
}
