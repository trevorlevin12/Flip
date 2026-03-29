import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/db/client'
import { getLeadsNeedingFollowUp, updateLead, logLeadEvent } from '@/lib/db/queries'
import { sendFollowUp } from '@/lib/conversation/engine'
import { differenceInHours } from 'date-fns'

const MAX_FOLLOW_UPS: Record<string, number> = {
  contacted:        2,
  tour_proposed:    3,
  application_sent: 3,
}

const FOLLOW_UP_MESSAGES: Record<string, string[]> = {
  contacted: [
    "Hey! Just checking in — still interested in the place? Happy to answer any questions!",
    "Last check-in from me — the unit is still available if you'd like to take a look!",
  ],
  tour_proposed: [
    "Hey, just wanted to confirm — do any of those tour times work for you?",
    "The spot is still available! Let me know if you'd like to lock in a time to see it.",
    "Last nudge — still happy to get you in for a look if the timing works!",
  ],
  application_sent: [
    "Just a quick reminder — the application link I sent is still active. Happy to help if you have questions!",
    "Wanted to check in on the application. Still interested? I can resend the link if you need it.",
    "Last reminder on the application — the unit is still available. Let me know if you'd like to move forward!",
  ],
}

export async function GET(req: NextRequest) {
  // Auth via secret header (set in Vercel cron config)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminClient()
  const leads = await getLeadsNeedingFollowUp(db)

  const results = { processed: 0, closed: 0, errors: 0 }

  for (const lead of leads) {
    try {
      const status = lead.status
      const maxAttempts = MAX_FOLLOW_UPS[status] ?? 2
      const messages = FOLLOW_UP_MESSAGES[status] ?? []

      // Count prior follow-up events
      const { data: events } = await db
        .from('lead_events')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('event_type', 'follow_up_sent')
      const attemptsSoFar = events?.length ?? 0

      if (attemptsSoFar >= maxAttempts) {
        // Max attempts reached → close
        await updateLead(db, lead.id, { status: 'closed_lost' })
        await logLeadEvent(db, lead.id, 'status_changed', {
          from: status,
          to: 'closed_lost',
          reason: 'max_follow_ups_reached',
        })
        results.closed++
        continue
      }

      const messageBody = messages[attemptsSoFar] ?? messages[messages.length - 1]
      await sendFollowUp(lead.id, messageBody)
      results.processed++
    } catch (err) {
      console.error(`[follow-ups] Failed for lead ${lead.id}:`, err)
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
