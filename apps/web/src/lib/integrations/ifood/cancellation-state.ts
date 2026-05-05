export type CancellationState =
  | 'NONE'
  | 'REQUESTED'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_REJECTED'
  | 'AGREEMENT_PROPOSED'
  | 'AGREEMENT_ACCEPTED'
  | 'AGREEMENT_REJECTED'
  | 'CANCELLED'

const TRANSITIONS: Record<CancellationState, CancellationState[]> = {
  NONE: ['REQUESTED'],
  REQUESTED: ['REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'AGREEMENT_PROPOSED'],
  REQUEST_ACCEPTED: ['CANCELLED', 'AGREEMENT_PROPOSED'],
  REQUEST_REJECTED: ['REQUESTED', 'AGREEMENT_PROPOSED'],
  AGREEMENT_PROPOSED: ['AGREEMENT_ACCEPTED', 'AGREEMENT_REJECTED'],
  AGREEMENT_ACCEPTED: ['CANCELLED'],
  AGREEMENT_REJECTED: ['REQUESTED'],
  CANCELLED: [],
}

export function canTransitionCancellationState(
  current: CancellationState,
  next: CancellationState
): boolean {
  if (current === next) return true
  return TRANSITIONS[current].includes(next)
}
