import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/db/client'
import { getLeadByPhone } from '@/lib/db/queries'
import { processInboundMessage } from '@/lib/conversation/engine'

// Twilio sends URL-encoded POST; in dev/test you can also POST JSON.
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''

  let from: string
  let body: string

  if (contentType.includes('application/x-www-form-urlencoded')) {
    // Twilio format
    const text = await req.text()
    const params = new URLSearchParams(text)
    from = params.get('From') ?? ''
    body = params.get('Body') ?? ''
  } else {
    // JSON format for dev/testing
    const json = await req.json().catch(() => ({}))
    from = json.from ?? json.From ?? ''
    body = json.body ?? json.Body ?? ''
  }

  if (!from || !body) {
    return new Response('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Normalize phone to E.164-ish
  const phone = from.startsWith('+') ? from : `+${from.replace(/\D/g, '')}`

  const db = getAdminClient()
  const lead = await getLeadByPhone(db, phone)

  if (!lead) {
    // Unknown sender — ignore
    return new Response('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Process async — respond to Twilio immediately
  processInboundMessage(lead.id, body).catch((err) =>
    console.error('[sms-inbound] processInboundMessage failed:', err)
  )

  // Return empty TwiML so Twilio doesn't say anything
  return new Response('<?xml version="1.0"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
