import { describe, it, expect } from 'vitest'
import { canTransition, transition, deriveStatus } from '@/lib/conversation/state-machine'

describe('canTransition', () => {
  it('allows new → contacted', () => {
    expect(canTransition('new', 'contacted')).toBe(true)
  })

  it('allows engaged → qualified', () => {
    expect(canTransition('engaged', 'qualified')).toBe(true)
  })

  it('allows any active status → escalated', () => {
    expect(canTransition('qualified', 'escalated')).toBe(true)
    expect(canTransition('engaged', 'escalated')).toBe(true)
  })

  it('blocks invalid transition', () => {
    expect(canTransition('new', 'application_completed')).toBe(false)
    expect(canTransition('closed_lost', 'new')).toBe(false)
  })
})

describe('transition', () => {
  it('throws on invalid transition', () => {
    expect(() => transition('closed_lost', 'new')).toThrow()
  })

  it('returns the target status on valid transition', () => {
    expect(transition('new', 'contacted')).toBe('contacted')
  })
})

describe('deriveStatus', () => {
  it('returns qualified when score ≥ 70 and all data collected', () => {
    expect(deriveStatus('engaged', 75, true, false)).toBe('qualified')
  })

  it('returns unqualified when score < 40 and all data collected', () => {
    expect(deriveStatus('engaged', 30, true, false)).toBe('unqualified')
  })

  it('returns escalated when score 40–69 and all data collected', () => {
    expect(deriveStatus('engaged', 55, true, false)).toBe('escalated')
  })

  it('keeps current status when data not yet fully collected', () => {
    expect(deriveStatus('engaged', 55, false, false)).toBe('engaged')
  })

  it('returns escalated when isEscalated flag is set', () => {
    expect(deriveStatus('engaged', 90, true, true)).toBe('escalated')
  })
})
