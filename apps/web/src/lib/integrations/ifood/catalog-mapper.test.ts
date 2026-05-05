import { mapCategoryToIfoodCategory, mapProductToIfoodProduct, toExternalCode } from './catalog-mapper'

describe('catalog mapper', () => {
  it('gera external code padrao', () => {
    expect(toExternalCode('product', 'abc')).toBe('product:abc')
  })

  it('mapeia categoria para payload iFood', () => {
    const category = mapCategoryToIfoodCategory({
      id: 'cat-1',
      name: 'Acaís',
      slug: 'acais',
    })
    expect(category.externalCode).toBe('category:cat-1')
    expect(category.name).toBe('Acaís')
  })

  it('mapeia produto para payload iFood', () => {
    const product = mapProductToIfoodProduct({
      product: {
        id: 'prod-1',
        name: 'Acaí Tradicional',
        description: 'Produto de teste',
        price: 21,
        available: true,
        categoryId: 'cat-1',
        imageUrl: null,
      },
    })
    expect(product.externalCode).toBe('product:prod-1')
    expect(product.categoryExternalCode).toBe('category:cat-1')
    expect(product.price).toBe(21)
  })
})
