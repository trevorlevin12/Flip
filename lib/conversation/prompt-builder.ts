import { format } from 'date-fns'
import type { Lead, Property, QualificationCriteria, TourSlot, Landlord } from '@/lib/types'

const PET_POLICY_LABELS: Record<string, string> = {
  none:        'No pets allowed',
  cats_only:   'Cats only',
  small_dogs:  'Small dogs under 25lb allowed',
  dogs_ok:     'Dogs welcome',
  all_ok:      'All pets welcome',
}

const SMOKING_LABELS: Record<string, string> = {
  not_allowed:  'No smoking',
  outside_only: 'Smoking outdoors only',
  allowed:      'Smoking permitted',
}

const EVICTION_LABELS: Record<string, string> = {
  none_accepted: 'No evictions accepted',
  case_by_case:  'Prior evictions reviewed case-by-case',
  not_concern:   'Eviction history not a deciding factor',
}

const VOUCHER_LABELS: Record<string, string> = {
  accepted:     'Housing vouchers / Section 8 accepted',
  not_accepted: 'Housing vouchers not accepted',
  case_by_case: 'Housing vouchers reviewed case-by-case',
}

function formatTourSlot(slot: TourSlot): string {
  return format(new Date(slot.start_time), "EEEE MMMM do 'at' h:mmaaa")
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`
}

function collectedLeadSummary(lead: Partial<Lead>): string {
  const lines: string[] = []
  if (lead.full_name)        lines.push(`Name: ${lead.full_name}`)
  if (lead.email)            lines.push(`Email: ${lead.email}`)
  if (lead.move_in_date)     lines.push(`Move-in date: ${lead.move_in_date}`)
  if (lead.occupant_count)   lines.push(`Occupants: ${lead.occupant_count}`)
  if (lead.has_pets != null) lines.push(`Pets: ${lead.has_pets ? (lead.pet_description ?? 'yes') : 'no'}`)
  if (lead.monthly_income)   lines.push(`Monthly income: ${formatCents(lead.monthly_income)}`)
  if (lead.employment_status) lines.push(`Employment: ${lead.employment_status}`)
  if (lead.credit_range)     lines.push(`Credit score range: ${lead.credit_range}`)
  if (lead.has_eviction != null) lines.push(`Eviction history: ${lead.has_eviction ? 'yes' : 'no'}`)
  return lines.length ? lines.join('\n') : 'Nothing collected yet.'
}

function remainingFields(lead: Partial<Lead>): string {
  const needed: string[] = []
  if (!lead.full_name)                  needed.push('full name')
  if (!lead.move_in_date)              needed.push('desired move-in date')
  if (lead.occupant_count == null)     needed.push('number of occupants')
  if (lead.has_pets == null)           needed.push('whether they have pets')
  if (!lead.monthly_income)            needed.push('monthly income')
  if (!lead.employment_status)         needed.push('employment status')
  if (!lead.credit_range)              needed.push('credit score range')
  if (lead.has_eviction == null)       needed.push('eviction history')
  return needed.length ? needed.join(', ') : 'All key info collected.'
}

export function buildSystemPrompt(params: {
  landlord: Landlord
  property: Property
  criteria: QualificationCriteria | null
  lead: Partial<Lead>
  tourSlots: TourSlot[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
}): string {
  const { landlord, property, criteria, lead, tourSlots } = params

  const rentFmt       = formatCents(property.rent_amount)
  const depositFmt    = formatCents(property.deposit_amount)
  const availFmt      = format(new Date(property.available_date), 'MMMM do, yyyy')
  const assistantName = landlord.assistant_name || 'Alex'

  const faqBlock = property.faq.length
    ? property.faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : 'No FAQs configured.'

  const tourSlotsBlock = tourSlots.length
    ? tourSlots.map((s, i) => `Option ${i + 1}: ${formatTourSlot(s)}`).join('\n')
    : 'No tour slots available. Tell the applicant the landlord will follow up to schedule.'

  const criteriaBlock = criteria
    ? `
- Minimum income: ${criteria.income_multiple}x monthly rent (${formatCents(Math.round(criteria.income_multiple * property.rent_amount))}/mo)
- Pets: ${PET_POLICY_LABELS[criteria.pet_policy]}
- Smoking: ${SMOKING_LABELS[criteria.smoking_policy]}
- Minimum credit score: ${criteria.min_credit_score ?? 'Not specified'}
- Eviction policy: ${EVICTION_LABELS[criteria.eviction_policy]}
- Max occupants: ${criteria.max_occupants ?? 'Not specified'}
- Minimum lease: ${criteria.min_lease_months} months
- Vouchers: ${VOUCHER_LABELS[criteria.voucher_policy]}
${criteria.additional_notes ? `- Additional: ${criteria.additional_notes}` : ''}`
    : 'No qualification criteria configured.'

  return `You are ${assistantName}, a leasing coordinator for ${landlord.name}'s property at ${property.address}.
Your job is to help prospective renters find out if this home is a good fit and move them toward scheduling a tour or completing an application.

PROPERTY DETAILS:
- Rent: ${rentFmt}/month
- Deposit: ${depositFmt}
- Bedrooms/Bathrooms: ${property.bedrooms}bd / ${property.bathrooms}ba
- Available: ${availFmt}
- Tour type: ${property.tour_type}
${property.application_url ? `- Application: ${property.application_url}` : ''}

QUALIFICATION CRITERIA:
${criteriaBlock}

AVAILABLE TOUR SLOTS:
${tourSlotsBlock}

PROPERTY FAQs:
${faqBlock}

WHAT YOU STILL NEED TO COLLECT:
${remainingFields(lead)}

COLLECTED INFO SO FAR:
${collectedLeadSummary(lead)}

CONVERSATION RULES:
1. Be warm, concise, and natural. Sound like a real person, not a bot.
2. Ask ONE question at a time. Never stack multiple questions in one message.
3. Keep messages short — this is SMS. 2-3 sentences max.
4. Move the conversation forward toward a tour or application.
5. When all info is collected and the person seems qualified, offer tour slots or application link.
6. If asked about rent negotiation, say "I'll pass that along to ${landlord.name}."
7. If anyone mentions disability, accommodation, fair housing rights, Section 8 denial, discrimination, or legal matters — say "Great question — I'll have ${landlord.name} follow up with you directly on that." Do NOT say anything else about the topic.
8. If someone asks to speak to a person or calls you a bot, say "Happy to have ${landlord.name} reach out directly. I'll let them know!"
9. Never tell someone they are approved or denied. You collect information only.
10. If you don't know the answer to a property question, say "Let me check with ${landlord.name} and get back to you."
11. Confirm tour times and names before finalizing.
12. When sending the application link, frame it positively: "Sounds like a great fit — want me to send the application link so you can lock in your spot?"

Respond with ONLY your next SMS message. No quotes, no labels, no explanation — just the message text. Keep it under 160 characters when possible.`
}

export function buildWarmOpenMessage(params: {
  assistantName: string
  prospectName: string | null
  propertyAddress: string
  bedrooms: number
  availableDate: string
}): string {
  const { assistantName, prospectName, propertyAddress, bedrooms, availableDate } = params
  const greeting = prospectName ? `Hi ${prospectName.split(' ')[0]}!` : 'Hi there!'
  const avail = format(new Date(availableDate), 'MMM do')
  return `${greeting} This is ${assistantName} reaching out about the ${bedrooms}bd at ${propertyAddress}, available ${avail}. Still interested? Happy to answer questions or get you set up to take a look!`
}
