import { describe, it, expect } from 'vitest'
import { scoreLead } from '@/lib/qualification/scorer'
import type { Lead, QualificationCriteria } from '@/lib/types'

const RENT = 200000 // $2,000/mo in cents

const baseCriteria: QualificationCriteria = {
  id: 'c1',
  property_id: 'p1',
  income_multiple: 3,
  income_min_monthly: 0,
  pet_policy: 'none',
  pet_preference: 'strongly_prefer_none',
  smoking_policy: 'not_allowed',
  min_credit_score: 620,
  eviction_policy: 'none_accepted',
  max_occupants: 2,
  min_lease_months: 12,
  voucher_policy: 'not_accepted',
  employment_preference: 'any_stable',
  move_in_preference: 'flexible',
  tenant_history_preference: 'clean_strongly',
  lease_length_preference: 'long_term',
  additional_notes: null,
  created_at: '',
  updated_at: '',
}

const baseLead: Partial<Lead> = {
  monthly_income:   600000,  // $6,000 — 3x rent
  move_in_date:     new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  occupant_count:   2,
  has_pets:         false,
  employment_status: 'employed',
  has_eviction:     false,
}

describe('scoreLead', () => {
  it('returns 100 for a perfect applicant', () => {
    const result = scoreLead(baseLead, baseCriteria, RENT)
    expect(result.score).toBe(100)
    expect(result.hardDisqualified).toBe(false)
    expect(result.needsEscalation).toBe(false)
  })

  it('hard disqualifies when occupants exceed max', () => {
    const result = scoreLead({ ...baseLead, occupant_count: 5 }, baseCriteria, RENT)
    expect(result.hardDisqualified).toBe(true)
    expect(result.score).toBe(0)
    expect(result.hardDisqualifierReason).toMatch(/exceeds/)
  })

  it('hard disqualifies on pet policy violation', () => {
    const result = scoreLead({ ...baseLead, has_pets: true }, baseCriteria, RENT)
    expect(result.hardDisqualified).toBe(true)
    expect(result.score).toBe(0)
  })

  it('hard disqualifies on eviction with none_accepted policy', () => {
    const result = scoreLead({ ...baseLead, has_eviction: true }, baseCriteria, RENT)
    expect(result.hardDisqualified).toBe(true)
    expect(result.score).toBe(0)
  })

  it('escalates on eviction with case_by_case policy', () => {
    const criteria = { ...baseCriteria, eviction_policy: 'case_by_case' as const }
    const result = scoreLead({ ...baseLead, has_eviction: true }, criteria, RENT)
    expect(result.hardDisqualified).toBe(false)
    expect(result.needsEscalation).toBe(true)
    expect(result.escalationReason).toBeTruthy()
  })

  it('scales income score linearly below floor', () => {
    // 3x rent floor = $6000. Lead earns $4500 (75% of floor = halfway between 50% and 100%)
    const result = scoreLead({ ...baseLead, monthly_income: 450000 }, baseCriteria, RENT)
    // 50% of floor = $3000 = 0pts, 100% = $6000 = 30pts
    // $4500 is 75% through the linear range → ~15pts
    expect(result.breakdown.income).toBeGreaterThan(0)
    expect(result.breakdown.income).toBeLessThan(30)
  })

  it('gives 0 income points below 50% of floor', () => {
    const result = scoreLead({ ...baseLead, monthly_income: 100000 }, baseCriteria, RENT)
    expect(result.breakdown.income).toBe(0)
  })

  it('reports allDataCollected correctly when all required fields present', () => {
    const result = scoreLead(baseLead, baseCriteria, RENT)
    expect(result.allDataCollected).toBe(true)
  })

  it('reports allDataCollected false when income missing', () => {
    const { monthly_income, ...noIncome } = baseLead
    const result = scoreLead(noIncome, baseCriteria, RENT)
    expect(result.allDataCollected).toBe(false)
  })
})
