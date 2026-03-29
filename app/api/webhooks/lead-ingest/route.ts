import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminClient } from '@/lib/db/client'
import { createLead, logLeadEvent } from '@/lib/db/queries'
import { sendWarmOpen } from '@/lib/conversation/engine'

const LeadIngestSchema = z.object({
  landlord_id: z.string().uuid(),
  property_id: z.string().uuid(),
  full_name:   z.string().optional(),
  phone:       z.string().min(10),
  email:       z.string().email().optional(),
  message:     z.string().optional(),
  source:      z.string().default('zillow'),
})

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = LeadIngestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const data = parsed.data
  const db = getAdminClient()

  // Create lead
  let lead
  try {
    lead = await createLead(db, {
      property_id:         data.property_id,
      status:              'new',
      qualification_score: 0,
      is_escalated:        false,
      escalation_reason:   null,
      full_name:           data.full_name ?? null,
      phone:               data.phone,
      email:               data.email ?? null,
      source:              data.source,
      move_in_date:        null,
      occupant_count:      null,
      has_pets:            null,
      pet_description:     null,
      monthly_income:      null,
      employment_status:   null,
      credit_range:        null,
      has_eviction:        null,
      eviction_context:    null,
      ready_to_apply:      null,
      last_contacted_at:   null,
      first_reply_at:      null,
    })
  } catch (err) {
    console.error('[lead-ingest] Failed to create lead:', err)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }

  await logLeadEvent(db, lead.id, 'lead_created', {
    source: data.source,
    initial_message: data.message,
  })

  // Fire warm open SMS asynchronously (don't await — respond fast)
  sendWarmOpen(lead.id).catch((err) =>
    console.error('[lead-ingest] sendWarmOpen failed:', err)
  )

  return NextResponse.json({ lead_id: lead.id }, { status: 201 })
}
