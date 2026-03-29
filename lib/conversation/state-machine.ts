import type { LeadStatus } from '@/lib/types'

// Valid transitions from each state
const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new:                    ['contacted', 'closed_lost'],
  contacted:              ['engaged', 'closed_lost', 'escalated'],
  engaged:                ['qualified', 'unqualified', 'escalated', 'closed_lost'],
  qualified:              ['tour_proposed', 'application_sent', 'escalated', 'closed_lost'],
  unqualified:            ['escalated', 'closed_lost'],
  tour_proposed:          ['tour_booked', 'qualified', 'escalated', 'closed_lost'],
  tour_booked:            ['application_sent', 'escalated', 'closed_lost'],
  application_sent:       ['application_started', 'tour_proposed', 'escalated', 'closed_lost'],
  application_started:    ['application_completed', 'escalated', 'closed_lost'],
  application_completed:  ['closed_lost'],
  escalated:              ['engaged', 'qualified', 'unqualified', 'closed_lost'],
  closed_lost:            [],
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function transition(from: LeadStatus, to: LeadStatus): LeadStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lead transition: ${from} → ${to}`)
  }
  return to
}

// Derive the next logical status from current lead data
export function deriveStatus(
  current: LeadStatus,
  score: number,
  allDataCollected: boolean,
  isEscalated: boolean
): LeadStatus {
  if (isEscalated) return 'escalated'

  if (current === 'engaged' && allDataCollected) {
    if (score >= 70) return 'qualified'
    if (score < 40) return 'unqualified'
    // 40-69 → escalate to landlord
    return 'escalated'
  }

  return current
}

// Human-readable labels for UI
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new:                    'New',
  contacted:              'Contacted',
  engaged:                'Engaged',
  qualified:              'Qualified',
  unqualified:            'Unqualified',
  tour_proposed:          'Tour Proposed',
  tour_booked:            'Tour Booked',
  application_sent:       'Application Sent',
  application_started:    'Application Started',
  application_completed:  'Application Completed',
  escalated:              'Escalated',
  closed_lost:            'Closed Lost',
}

// Urgency ordering for dashboard sorting
export const STATUS_URGENCY: Record<LeadStatus, number> = {
  escalated:              10,
  tour_proposed:           9,
  qualified:               8,
  application_sent:        7,
  engaged:                 6,
  tour_booked:             5,
  application_started:     4,
  contacted:               3,
  application_completed:   2,
  new:                     1,
  unqualified:             0,
  closed_lost:             0,
}

export function isActiveStatus(status: LeadStatus): boolean {
  return !['closed_lost', 'unqualified', 'application_completed'].includes(status)
}
