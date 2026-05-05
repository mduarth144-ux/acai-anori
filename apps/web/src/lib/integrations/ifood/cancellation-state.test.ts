import { canTransitionCancellationState } from './cancellation-state'

describe('canTransitionCancellationState', () => {
  it('permite fluxo principal ate cancelado', () => {
    expect(canTransitionCancellationState('NONE', 'REQUESTED')).toBe(true)
    expect(canTransitionCancellationState('REQUESTED', 'REQUEST_ACCEPTED')).toBe(true)
    expect(canTransitionCancellationState('REQUEST_ACCEPTED', 'CANCELLED')).toBe(true)
  })

  it('bloqueia salto invalido', () => {
    expect(canTransitionCancellationState('NONE', 'CANCELLED')).toBe(false)
    expect(canTransitionCancellationState('AGREEMENT_REJECTED', 'CANCELLED')).toBe(false)
  })
})
