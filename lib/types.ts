export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'engaged'
  | 'qualified'
  | 'unqualified'
  | 'tour_proposed'
  | 'tour_booked'
  | 'application_sent'
  | 'application_started'
  | 'application_completed'
  | 'escalated'
  | 'closed_lost'

export type PetPolicy = 'none' | 'cats_only' | 'small_dogs' | 'dogs_ok' | 'all_ok'
export type SmokingPolicy = 'not_allowed' | 'outside_only' | 'allowed'
export type EvictionPolicy = 'none_accepted' | 'case_by_case' | 'not_concern'
export type VoucherPolicy = 'accepted' | 'not_accepted' | 'case_by_case'
export type TourType = 'in-person' | 'self-guided' | 'both'

export interface FAQ {
  question: string
  answer: string
}

export interface EscalationPrefs {
  notify_sms: boolean
  notify_email: boolean
}

export interface Landlord {
  id: string
  user_id: string
  name: string
  assistant_name: string
  notification_phone: string | null
  notification_email: string | null
  escalation_prefs: EscalationPrefs
  created_at: string
}

export interface Property {
  id: string
  landlord_id: string
  name: string
  address: string
  rent_amount: number        // cents
  target_rent_min: number    // cents
  deposit_amount: number     // cents
  bedrooms: number
  bathrooms: number
  available_date: string     // ISO date
  application_url: string | null
  tour_type: TourType
  faq: FAQ[]
  is_active: boolean
  created_at: string
}

export interface QualificationCriteria {
  id: string
  property_id: string
  income_multiple: number
  income_min_monthly: number   // cents
  pet_policy: PetPolicy
  pet_preference: 'strongly_prefer_none' | 'open' | 'fine'
  smoking_policy: SmokingPolicy
  min_credit_score: number | null
  eviction_policy: EvictionPolicy
  max_occupants: number | null
  min_lease_months: number
  voucher_policy: VoucherPolicy
  employment_preference: 'w2_preferred' | 'self_employed_ok' | 'any_stable'
  move_in_preference: 'asap' | '30_days' | '60_days' | 'flexible'
  tenant_history_preference: 'clean_strongly' | 'minor_ok' | 'flexible'
  lease_length_preference: 'long_term' | 'flexible' | 'short_ok'
  additional_notes: string | null
  created_at: string
  updated_at: string
}

export interface TourSlot {
  id: string
  property_id: string
  start_time: string    // ISO datetime
  end_time: string      // ISO datetime
  is_booked: boolean
  lead_id: string | null
  created_at: string
}

export interface Lead {
  id: string
  property_id: string
  status: LeadStatus
  qualification_score: number
  is_escalated: boolean
  escalation_reason: string | null
  // Contact
  full_name: string | null
  phone: string
  email: string | null
  source: string
  // Collected applicant data
  move_in_date: string | null    // ISO date
  occupant_count: number | null
  has_pets: boolean | null
  pet_description: string | null
  monthly_income: number | null  // cents
  employment_status: string | null
  credit_range: string | null
  has_eviction: boolean | null
  eviction_context: string | null
  ready_to_apply: boolean | null
  // Timestamps
  created_at: string
  last_contacted_at: string | null
  first_reply_at: string | null
  updated_at: string
}

export interface Message {
  id: string
  lead_id: string
  direction: 'inbound' | 'outbound'
  channel: 'sms'
  body: string
  sent_at: string
  metadata: Record<string, unknown>
}

export type LeadEventType =
  | 'lead_created'
  | 'sms_sent'
  | 'sms_received'
  | 'status_changed'
  | 'score_updated'
  | 'escalated'
  | 'tour_booked'
  | 'application_sent'
  | 'follow_up_sent'

export interface LeadEvent {
  id: string
  lead_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

// Joined types for UI queries
export interface LeadWithProperty extends Lead {
  properties: Property
}

export interface LeadWithMessages extends Lead {
  messages: Message[]
}

export interface PropertyWithCriteria extends Property {
  qualification_criteria: QualificationCriteria | null
}
