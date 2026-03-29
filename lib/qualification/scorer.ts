import type { Lead, QualificationCriteria } from '@/lib/types'
import { differenceInDays } from 'date-fns'

export interface ScoringBreakdown {
  income: number        // max 30
  moveIn: number        // max 20
  occupancy: number     // max 15
  pets: number          // max 15
  eviction: number      // max 20
}

export interface ScoringResult {
  score: number
  breakdown: ScoringBreakdown
  hardDisqualified: boolean
  hardDisqualifierReason?: string
  needsEscalation: boolean
  escalationReason?: string
  allDataCollected: boolean
}

// Which lead fields constitute "all data collected"
const REQUIRED_FIELDS: (keyof Lead)[] = [
  'monthly_income',
  'move_in_date',
  'occupant_count',
  'has_pets',
  'employment_status',
]

export function scoreLead(
  lead: Partial<Lead>,
  criteria: QualificationCriteria,
  rentAmount: number   // cents
): ScoringResult {
  const breakdown: ScoringBreakdown = {
    income: 0,
    moveIn: 0,
    occupancy: 0,
    pets: 0,
    eviction: 0,
  }
  let hardDisqualified = false
  let hardDisqualifierReason: string | undefined
  let needsEscalation = false
  let escalationReason: string | undefined

  // ── Income (30 pts) ────────────────────────────────────────────────────────
  if (lead.monthly_income != null) {
    const incomeFloor = criteria.income_multiple * rentAmount
    if (lead.monthly_income >= incomeFloor) {
      breakdown.income = 30
    } else if (lead.monthly_income >= incomeFloor * 0.5) {
      // Scale linearly: 50% of floor = 0 pts, 100% of floor = 30 pts
      breakdown.income = Math.round(
        ((lead.monthly_income - incomeFloor * 0.5) / (incomeFloor * 0.5)) * 30
      )
    }
  }

  // ── Move-in timeline (20 pts) ───────────────────────────────────────────────
  if (lead.move_in_date) {
    const daysUntilMoveIn = differenceInDays(new Date(lead.move_in_date), new Date())
    const pref = criteria.move_in_preference

    if (pref === 'asap') {
      breakdown.moveIn = daysUntilMoveIn <= 30 ? 20 : daysUntilMoveIn <= 60 ? 10 : 0
    } else if (pref === '30_days') {
      breakdown.moveIn = daysUntilMoveIn <= 45 ? 20 : daysUntilMoveIn <= 75 ? 10 : 0
    } else if (pref === '60_days') {
      breakdown.moveIn = daysUntilMoveIn <= 75 ? 20 : daysUntilMoveIn <= 120 ? 10 : 0
    } else {
      // flexible — any reasonable timeline
      breakdown.moveIn = daysUntilMoveIn <= 120 ? 20 : 10
    }
  }

  // ── Occupancy (15 pts) ─────────────────────────────────────────────────────
  if (lead.occupant_count != null && criteria.max_occupants != null) {
    if (lead.occupant_count <= criteria.max_occupants) {
      breakdown.occupancy = 15
    } else {
      hardDisqualified = true
      hardDisqualifierReason = `${lead.occupant_count} occupants exceeds the maximum of ${criteria.max_occupants}`
    }
  } else {
    breakdown.occupancy = 15 // benefit of the doubt if no limit set
  }

  // ── Pets (15 pts) ──────────────────────────────────────────────────────────
  if (lead.has_pets != null) {
    if (!lead.has_pets) {
      breakdown.pets = 15
    } else {
      // Has pets — check against policy
      if (criteria.pet_policy === 'none') {
        hardDisqualified = true
        hardDisqualifierReason = 'No pets allowed at this property'
      } else {
        // pets allowed in some form — partial score based on preference
        breakdown.pets = criteria.pet_preference === 'fine' ? 15
          : criteria.pet_preference === 'open' ? 10
          : 5
      }
    }
  }

  // ── Eviction history (20 pts) ──────────────────────────────────────────────
  if (lead.has_eviction != null) {
    if (!lead.has_eviction) {
      breakdown.eviction = 20
    } else {
      if (criteria.eviction_policy === 'none_accepted') {
        hardDisqualified = true
        hardDisqualifierReason = 'Prior eviction — this property requires a clean eviction history'
      } else if (criteria.eviction_policy === 'case_by_case') {
        breakdown.eviction = 5
        needsEscalation = true
        escalationReason = 'Applicant has a prior eviction — needs landlord review'
      } else {
        breakdown.eviction = 15 // 'not_concern'
      }
    }
  }

  const score = hardDisqualified ? 0 : Math.min(
    100,
    breakdown.income + breakdown.moveIn + breakdown.occupancy + breakdown.pets + breakdown.eviction
  )

  const allDataCollected = REQUIRED_FIELDS.every(
    (f) => lead[f] != null
  )

  return {
    score,
    breakdown,
    hardDisqualified,
    hardDisqualifierReason,
    needsEscalation: needsEscalation && !hardDisqualified,
    escalationReason,
    allDataCollected,
  }
}
