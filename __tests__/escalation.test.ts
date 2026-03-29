import { describe, it, expect } from 'vitest'
import { checkMessageForEscalation, buildLandlordEscalationSMS } from '@/lib/escalation/escalation'

describe('checkMessageForEscalation', () => {
  it('detects disability keyword', () => {
    const result = checkMessageForEscalation('I have a disability and need accommodation')
    expect(result.shouldEscalate).toBe(true)
  })

  it('detects human escalation request', () => {
    expect(checkMessageForEscalation('I want to speak to someone real').shouldEscalate).toBe(true)
    expect(checkMessageForEscalation('can I call me instead').shouldEscalate).toBe(true)
  })

  it('detects fair housing keywords', () => {
    expect(checkMessageForEscalation('is this discrimination?').shouldEscalate).toBe(true)
    expect(checkMessageForEscalation('fair housing question').shouldEscalate).toBe(true)
  })

  it('does not escalate normal messages', () => {
    expect(checkMessageForEscalation('what is the deposit?').shouldEscalate).toBe(false)
    expect(checkMessageForEscalation('I can move in April 1st').shouldEscalate).toBe(false)
    expect(checkMessageForEscalation('I have 2 kids').shouldEscalate).toBe(false)
  })
})

describe('buildLandlordEscalationSMS', () => {
  it('builds a sensible notification message', () => {
    const msg = buildLandlordEscalationSMS(
      'Jane Smith',
      '123 Oak St',
      'Keyword detected: "disability"',
      'https://app.getflip.ai/inbox/abc'
    )
    expect(msg).toContain('Jane Smith')
    expect(msg).toContain('123 Oak St')
    expect(msg).toContain('disability')
  })

  it('handles null name gracefully', () => {
    const msg = buildLandlordEscalationSMS(null, '123 Oak St', 'reason', 'https://url')
    expect(msg).toContain('a prospect')
  })
})
