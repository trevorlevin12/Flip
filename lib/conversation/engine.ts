import { getAdminClient } from '@/lib/db/client'
import {
  getLeadById,
  updateLead,
  createMessage,
  getMessagesByLead,
  getPropertyById,
  getLandlordById,
  getAvailableTourSlots,
  logLeadEvent,
  bookTourSlot,
} from '@/lib/db/queries'
import { sendSMS } from '@/lib/sms'
import { chat } from '@/lib/llm'
import { buildSystemPrompt, buildWarmOpenMessage } from './prompt-builder'
import { scoreLead } from '@/lib/qualification/scorer'
import { deriveStatus, canTransition } from './state-machine'
import {
  checkMessageForEscalation,
  buildLandlordEscalationSMS,
} from '@/lib/escalation/escalation'
import type { Lead, Message, LeadStatus } from '@/lib/types'

// ── Warm open after lead ingest ────────────────────────────────────────────────

export async function sendWarmOpen(leadId: string): Promise<void> {
  const db = getAdminClient()
  const lead = await getLeadById(db, leadId)
  if (!lead) throw new Error(`Lead not found: ${leadId}`)

  const property = await getPropertyById(db, lead.property_id)
  if (!property) throw new Error(`Property not found: ${lead.property_id}`)

  const landlord = await getLandlordById(db, property.landlord_id)
  if (!landlord) throw new Error(`Landlord not found: ${property.landlord_id}`)

  const assistantName = landlord.assistant_name || 'Alex'
  const body = buildWarmOpenMessage({
    assistantName,
    prospectName: lead.full_name,
    propertyAddress: property.address,
    bedrooms: property.bedrooms,
    availableDate: property.available_date,
  })

  const { sid } = await sendSMS(lead.phone, body)

  await createMessage(db, {
    lead_id: leadId,
    direction: 'outbound',
    channel: 'sms',
    body,
    sent_at: new Date().toISOString(),
    metadata: { sid },
  })

  await updateLead(db, leadId, {
    status: 'contacted',
    last_contacted_at: new Date().toISOString(),
  })

  await logLeadEvent(db, leadId, 'sms_sent', { body, sid, phase: 'warm_open' })
}

// ── Process inbound SMS reply ──────────────────────────────────────────────────

export async function processInboundMessage(
  leadId: string,
  inboundBody: string
): Promise<void> {
  const db = getAdminClient()
  const lead = await getLeadById(db, leadId)
  if (!lead) throw new Error(`Lead not found: ${leadId}`)

  // Halt AI if already escalated
  if (lead.is_escalated) return

  const property = await getPropertyById(db, lead.property_id)
  if (!property) throw new Error(`Property not found`)

  const landlord = await getLandlordById(db, property.landlord_id)
  if (!landlord) throw new Error(`Landlord not found`)

  // Record inbound message
  await createMessage(db, {
    lead_id: leadId,
    direction: 'inbound',
    channel: 'sms',
    body: inboundBody,
    sent_at: new Date().toISOString(),
    metadata: {},
  })

  await logLeadEvent(db, leadId, 'sms_received', { body: inboundBody })

  // Track first reply
  const leadUpdates: Partial<Lead> = {}
  if (!lead.first_reply_at) {
    leadUpdates.first_reply_at = new Date().toISOString()
  }
  if (lead.status === 'contacted') {
    leadUpdates.status = 'engaged'
  }

  // Check for escalation triggers
  const escalationCheck = checkMessageForEscalation(inboundBody)
  if (escalationCheck.shouldEscalate) {
    await escalateLead(db, lead, property, landlord, escalationCheck.reason!)
    return
  }

  // Extract data from message (best-effort field updates)
  const extractedUpdates = extractLeadData(inboundBody, lead)
  Object.assign(leadUpdates, extractedUpdates)

  // Apply updates so far
  if (Object.keys(leadUpdates).length) {
    await updateLead(db, leadId, leadUpdates)
  }

  // Re-fetch updated lead for scoring
  const updatedLead = await getLeadById(db, leadId)!
  if (!updatedLead) return

  // Score and potentially transition
  const criteria = property.qualification_criteria
  if (criteria) {
    const scoring = scoreLead(updatedLead, criteria, property.rent_amount)
    const newStatus = deriveStatus(
      updatedLead.status as LeadStatus,
      scoring.score,
      scoring.allDataCollected,
      scoring.needsEscalation
    )

    if (newStatus !== updatedLead.status && canTransition(updatedLead.status as LeadStatus, newStatus)) {
      await updateLead(db, leadId, {
        status: newStatus,
        qualification_score: scoring.score,
        is_escalated: newStatus === 'escalated',
        escalation_reason: scoring.escalationReason ?? null,
      })
      await logLeadEvent(db, leadId, 'status_changed', {
        from: updatedLead.status,
        to: newStatus,
        score: scoring.score,
      })

      if (newStatus === 'escalated' && scoring.escalationReason) {
        await escalateLead(db, updatedLead, property, landlord, scoring.escalationReason)
        return
      }
    } else if (scoring.score !== updatedLead.qualification_score) {
      await updateLead(db, leadId, { qualification_score: scoring.score })
      await logLeadEvent(db, leadId, 'score_updated', { score: scoring.score })
    }
  }

  // Build AI response
  const finalLead = await getLeadById(db, leadId)
  if (!finalLead) return

  const recentMessages = await getMessagesByLead(db, leadId, 10)
  const tourSlots = await getAvailableTourSlots(db, property.id)

  const systemPrompt = buildSystemPrompt({
    landlord,
    property,
    criteria: criteria ?? null,
    lead: finalLead,
    tourSlots,
    recentMessages: recentMessages.map((m) => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.body,
    })),
  })

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...recentMessages.map((m) => ({
      role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body,
    })),
    { role: 'user' as const, content: inboundBody },
  ]

  const aiReply = await chat(messages)

  // Send reply
  const { sid } = await sendSMS(finalLead.phone, aiReply)

  await createMessage(db, {
    lead_id: leadId,
    direction: 'outbound',
    channel: 'sms',
    body: aiReply,
    sent_at: new Date().toISOString(),
    metadata: { sid, model: 'gpt-4o-mini' },
  })

  await updateLead(db, leadId, { last_contacted_at: new Date().toISOString() })
  await logLeadEvent(db, leadId, 'sms_sent', { body: aiReply, sid })
}

// ── Send follow-up ─────────────────────────────────────────────────────────────

export async function sendFollowUp(
  leadId: string,
  followUpBody: string
): Promise<void> {
  const db = getAdminClient()
  const lead = await getLeadById(db, leadId)
  if (!lead) return

  const { sid } = await sendSMS(lead.phone, followUpBody)

  await createMessage(db, {
    lead_id: leadId,
    direction: 'outbound',
    channel: 'sms',
    body: followUpBody,
    sent_at: new Date().toISOString(),
    metadata: { sid, type: 'follow_up' },
  })

  await updateLead(db, leadId, { last_contacted_at: new Date().toISOString() })
  await logLeadEvent(db, leadId, 'follow_up_sent', { body: followUpBody })
}

// ── Escalation ─────────────────────────────────────────────────────────────────

async function escalateLead(
  db: ReturnType<typeof getAdminClient>,
  lead: Lead,
  property: Awaited<ReturnType<typeof getPropertyById>>,
  landlord: Awaited<ReturnType<typeof getLandlordById>>,
  reason: string
): Promise<void> {
  await updateLead(db, lead.id, {
    status: 'escalated',
    is_escalated: true,
    escalation_reason: reason,
  })

  await logLeadEvent(db, lead.id, 'escalated', { reason })

  // Notify landlord by SMS if configured
  if (landlord?.notification_phone) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.getflip.ai'
    const notifBody = buildLandlordEscalationSMS(
      lead.full_name,
      property?.address ?? 'your property',
      reason,
      `${appUrl}/inbox/${lead.id}`
    )
    await sendSMS(landlord.notification_phone, notifBody)
  }

  // Send holding message to prospect
  const assistantName = landlord?.assistant_name || 'Alex'
  const landlordName = landlord?.name || 'the landlord'
  const holdingMessage = `Happy to have ${landlordName} follow up with you directly on that! They'll be in touch soon.`
  const { sid } = await sendSMS(lead.phone, holdingMessage)

  await createMessage(db, {
    lead_id: lead.id,
    direction: 'outbound',
    channel: 'sms',
    body: holdingMessage,
    sent_at: new Date().toISOString(),
    metadata: { sid, type: 'escalation_hold' },
  })
}

// ── Naive field extraction from SMS text ───────────────────────────────────────
// The LLM handles nuanced conversation; this catches obvious structured answers.

function extractLeadData(message: string, currentLead: Lead): Partial<Lead> {
  const updates: Partial<Lead> = {}
  const lower = message.toLowerCase().trim()

  // Pet detection
  if (currentLead.has_pets === null) {
    if (/\bno pets?\b|don'?t have (a |any )?pets?|no animals/i.test(message)) {
      updates.has_pets = false
    } else if (/\bhave (a |some )?pets?|(\d+) (cats?|dogs?|pets?)|yes.*pets?|pets?.*yes/i.test(message)) {
      updates.has_pets = true
      const petMatch = message.match(/(?:\d+ )?(?:cats?|dogs?|rabbits?|birds?|pets?)/i)
      if (petMatch) updates.pet_description = petMatch[0]
    }
  }

  // Eviction detection
  if (currentLead.has_eviction === null) {
    if (/no evictions?|never been evicted|clean record/i.test(message)) {
      updates.has_eviction = false
    } else if (/\beviction\b|been evicted|had an eviction/i.test(message)) {
      updates.has_eviction = true
      updates.eviction_context = message.trim()
    }
  }

  // Ready to apply
  if (currentLead.ready_to_apply === null) {
    if (/\bapply\b.*\bnow\b|\bready to apply\b|send.*application|yes.*apply/i.test(lower)) {
      updates.ready_to_apply = true
    }
  }

  return updates
}
