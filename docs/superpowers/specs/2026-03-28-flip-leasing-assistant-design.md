# Flip — AI Leasing Assistant: Design Spec
**Date:** 2026-03-28
**Status:** Approved
**Stack:** Next.js 14 (App Router) · TypeScript · Supabase (Postgres + Auth + Realtime) · Vercel · OpenAI GPT-4o-mini · Twilio SMS (stubbed in dev)

---

## 1. Product Summary

Flip is a lead conversion assistant for independent landlords and small property managers who already receive Zillow inquiries but lose deals because they respond too slowly or inconsistently. The core insight is that Zillow solves demand — Flip solves conversion.

When a Zillow lead arrives, Flip instantly replies by SMS, qualifies the prospect through a natural conversation, answers property FAQs, and moves the lead toward either booking a tour or completing an application — all without the landlord lifting a finger unless truly needed.

**Primary metric:** More completed applications and booked tours from the same Zillow lead volume.

---

## 2. Target Users

- Independent landlords (1–10 units)
- Small portfolio owners
- Small property management companies
- People who already pay for Zillow listings but fail to respond fast enough

---

## 3. User Flow

```
1. Landlord signs up → creates property → completes Ideal Tenant Profile
2. Landlord sets up Zapier/Make to POST Zillow lead emails to /api/webhooks/lead-ingest
3. Zillow lead arrives → Flip instantly sends warm SMS to prospect
4. Prospect replies → Flip converses, qualifies, and routes:
   a. Qualified + tour preferred  → offers tour slots → confirms booking
   b. Qualified + ready to apply  → sends application link → tracks completion
   c. Borderline                  → continues conversation, re-evaluates
   d. Unqualified                 → politely closes or routes to landlord
   e. Edge case / legal question  → escalates to landlord with full context
5. Landlord receives dashboard updates in real time
6. Landlord only intervenes for escalations or manual overrides
```

---

## 4. System Architecture

```
Zillow Lead Email
      │
      ▼
 Zapier/Make ──POST──▶  /api/webhooks/lead-ingest
                                   │
                         Create Lead + LeadEvent
                         Enqueue SMS (async via route handler)
                                   │
                         ┌─────────▼──────────┐
                         │   SMS Abstraction   │
                         │  ConsoleSMS (dev)   │
                         │  TwilioSMS (prod)   │
                         └─────────┬──────────┘
                                   │
                         Prospect replies via SMS
                                   │
                         POST /api/webhooks/sms-inbound
                                   │
                         ConversationEngine
                         ├── MessageBuilder (prompt assembly)
                         ├── LLM Client (GPT-4o-mini)
                         ├── PropertyContext (FAQs, criteria)
                         ├── QualificationEngine (scoring)
                         └── StateMachine (status transitions)
                                   │
                    ┌──────────────▼──────────────────┐
                    │         Supabase Postgres         │
                    │  landlords, properties,           │
                    │  qualification_criteria,          │
                    │  tour_slots, leads,               │
                    │  messages, lead_events            │
                    └──────────────┬──────────────────┘
                                   │
                    Vercel Cron → /api/cron/follow-ups (daily)
                                   │
                    Next.js Dashboard ← Supabase Realtime
```

**Key principles:**
- All lead processing happens in Next.js API routes (serverless, sub-60s operations)
- SMS abstraction swaps provider via `SMS_PROVIDER=console|twilio` env var
- LLM abstraction swaps model via `LLM_PROVIDER=openai|anthropic` env var
- Supabase Realtime pushes dashboard updates without polling

---

## 5. Database Schema

### `landlords`
```sql
id uuid PK
user_id uuid FK → auth.users
name text
notification_phone text
notification_email text
escalation_prefs jsonb  -- what triggers a landlord alert
created_at timestamptz
```

### `properties`
```sql
id uuid PK
landlord_id uuid FK → landlords
name text
address text
rent_amount integer          -- cents
target_rent_min integer      -- cents (won't go below this)
deposit_amount integer       -- cents
bedrooms integer
bathrooms numeric
available_date date
application_url text
tour_type text               -- 'in-person' | 'self-guided' | 'both'
faq jsonb                    -- [{question, answer}]
is_active boolean
created_at timestamptz
```

### `qualification_criteria`
```sql
id uuid PK
property_id uuid FK → properties (unique)
-- Multiple choice fields
income_multiple numeric        -- e.g. 3.0 = 3x rent
income_min_monthly integer     -- absolute floor in cents
pet_policy text                -- 'none' | 'cats_only' | 'small_dogs' | 'dogs_ok' | 'all_ok'
pet_preference text            -- 'strongly_prefer_none' | 'open' | 'fine'
smoking_policy text            -- 'not_allowed' | 'outside_only' | 'allowed'
min_credit_score integer
eviction_policy text           -- 'none_accepted' | 'case_by_case' | 'not_concern'
max_occupants integer
min_lease_months integer
voucher_policy text            -- 'accepted' | 'not_accepted' | 'case_by_case'
-- Guided preference questions
employment_preference text     -- 'w2_preferred' | 'self_employed_ok' | 'any_stable'
move_in_preference text        -- 'asap' | '30_days' | '60_days' | 'flexible'
tenant_history_preference text -- 'clean_strongly' | 'minor_ok' | 'flexible'
lease_length_preference text   -- 'long_term' | 'flexible' | 'short_ok'
additional_notes text          -- optional freeform
created_at timestamptz
updated_at timestamptz
```

### `tour_slots`
```sql
id uuid PK
property_id uuid FK → properties
start_time timestamptz
end_time timestamptz
is_booked boolean
lead_id uuid FK → leads (nullable)
created_at timestamptz
```

### `leads`
```sql
id uuid PK
property_id uuid FK → properties
-- Status
status text  -- enum: new|contacted|engaged|qualified|unqualified|
             --       tour_proposed|tour_booked|application_sent|
             --       application_started|application_completed|
             --       escalated|closed_lost
qualification_score integer  -- 0-100
is_escalated boolean
escalation_reason text
-- Contact info
full_name text
phone text
email text
source text  -- 'zillow' | 'manual' | other
-- Applicant info (collected over conversation)
move_in_date date
occupant_count integer
has_pets boolean
pet_description text
monthly_income integer       -- cents
employment_status text
credit_range text
has_eviction boolean
eviction_context text
ready_to_apply boolean
-- Timestamps
created_at timestamptz
last_contacted_at timestamptz
first_reply_at timestamptz   -- when prospect first responded
updated_at timestamptz
```

### `messages`
```sql
id uuid PK
lead_id uuid FK → leads
direction text       -- 'inbound' | 'outbound'
channel text         -- 'sms'
body text
sent_at timestamptz
metadata jsonb       -- twilio SID, model used, tokens, etc.
```

### `lead_events`
```sql
id uuid PK
lead_id uuid FK → leads
event_type text      -- 'lead_created' | 'sms_sent' | 'sms_received' |
                     --  'status_changed' | 'score_updated' | 'escalated' |
                     --  'tour_booked' | 'application_sent' | 'follow_up_sent'
payload jsonb        -- event-specific data
created_at timestamptz
```

---

## 6. Lead State Machine

```
NEW
 │  webhook received → instant SMS sent
 ▼
CONTACTED
 │  prospect sends any reply
 ▼
ENGAGED
 │  AI collecting qualification data
 ├──[score < 40]──────────────────────────▶ UNQUALIFIED
 ├──[legal/fair housing/uncertain]──────────▶ ESCALATED
 ▼
QUALIFIED  (score ≥ 70)
 ├──[tour first]──▶ TOUR_PROPOSED
 │                      │ prospect picks slot
 │                      ▼
 │                 TOUR_BOOKED
 │
 └──[apply now]──▶ APPLICATION_SENT
                       │ link opened
                       ▼
                  APPLICATION_STARTED
                       │ submitted
                       ▼
                  APPLICATION_COMPLETED

Any state ──[landlord override / legal / no reply 30d]──▶ CLOSED_LOST
Any state ──[escalation trigger]────────────────────────▶ ESCALATED
```

**Escalation triggers:**
- Fair housing or discrimination question detected
- Prospect mentions disability accommodation
- Lead score 40–69 after full data collected (borderline — landlord decides)
- Prospect expresses frustration or asks to speak to a human
- Conversation stalls for 72h on a qualified lead
- Landlord manually escalates from dashboard

**Follow-up cron (Vercel Cron, daily at 9am):**
- `TOUR_PROPOSED` with no reply after 24h → nudge (max 3 attempts)
- `APPLICATION_SENT` with no progress after 48h → reminder (max 3 attempts, spaced 48h)
- `CONTACTED` with no reply after 48h → re-engagement (max 2 attempts)
- After max attempts → `CLOSED_LOST`

---

## 7. Qualification Scoring

Score is 0–100. Weights are property-specific based on `qualification_criteria`.

| Factor | Max Points | Logic |
|--------|-----------|-------|
| Income | 30 | income ≥ income_multiple × rent = full points; scales linearly below |
| Move-in timeline | 20 | matches landlord preference = full; 1 bracket off = 10; 2+ = 0 |
| Occupancy | 15 | within limit = full; over limit = 0 (hard disqualifier option) |
| Pet match | 15 | matches policy = full; violates hard policy = 0 |
| No eviction | 20 | none = full; has eviction + policy = 'none_accepted' = 0; case_by_case = escalate |

Score ≥ 70 → **Qualified**
Score 40–69 → **Engaged** (continue collecting all data; if score remains 40–69 after all fields are collected, escalate to landlord for final call)
Score < 40 → **Unqualified** (close politely; escalate only if a single hard criterion caused the drop and landlord has set that criterion to 'case_by_case')

Hard disqualifiers (if configured) override score and immediately disqualify or escalate regardless of total.

---

## 8. AI Conversation Strategy

### System Prompt Architecture

The system prompt is assembled dynamically per conversation from:

1. **Persona block** — who the assistant is
2. **Property context block** — rent, deposit, bedrooms, available date, FAQs
3. **Qualification criteria block** — built from the landlord's guided answers, phrased as natural rules
4. **Ideal tenant profile block** — synthesized from the multiple-choice and preference questions
5. **Conversation rules block** — behavioral constraints (one question at a time, fair housing, escalation)
6. **Current lead state block** — what's been collected, what's still needed
7. **Available tour slots block** — formatted times to offer
8. **Application link block** — when and how to send it

### Default System Prompt

```
You are a leasing coordinator assistant for [LANDLORD_NAME]'s property at [PROPERTY_ADDRESS].
Your job is to help prospective renters find out if this home is a good fit and move them
toward scheduling a tour or completing an application.

PROPERTY DETAILS:
- Rent: $[RENT]/month
- Deposit: $[DEPOSIT]
- Bedrooms/Bathrooms: [BEDS]/[BATHS]
- Available: [AVAILABLE_DATE]
- Tour type: [TOUR_TYPE]
- Application: [APPLICATION_URL]

IDEAL TENANT PROFILE:
[SYNTHESIZED FROM QUALIFICATION CRITERIA — e.g.:]
- Looking for a tenant earning at least $[INCOME_MIN]/month
- [EMPLOYMENT_PREFERENCE phrased naturally]
- [PET_PREFERENCE phrased naturally]
- [LEASE_LENGTH_PREFERENCE phrased naturally]
- [ADDITIONAL_NOTES if any]

QUALIFICATION CRITERIA:
- Minimum income: [INCOME_MULTIPLE]x monthly rent ($[RENT_X_MULTIPLE]/mo)
- Pets: [PET_POLICY]
- Smoking: [SMOKING_POLICY]
- Minimum credit score: [MIN_CREDIT]
- Eviction policy: [EVICTION_POLICY]
- Max occupants: [MAX_OCCUPANTS]
- Min lease: [MIN_LEASE_MONTHS] months
- Vouchers: [VOUCHER_POLICY]

WHAT YOU STILL NEED TO COLLECT:
[REMAINING_FIELDS — dynamically updated each turn]

AVAILABLE TOUR SLOTS:
[TOUR_SLOTS — formatted as "Thursday April 3rd at 2pm" etc.]

CONVERSATION RULES:
1. Be warm, concise, and natural. Sound like a real person, not a bot.
2. Ask ONE question at a time. Never stack multiple questions in one message.
3. Keep messages short — this is SMS. 2-3 sentences max.
4. Move the conversation forward toward a tour or application.
5. If someone asks about rent negotiation, say "I'll pass that along to the landlord."
6. If someone asks about disability accommodations, fair housing rights, or anything
   legally sensitive, say "Great question — I'll have the landlord follow up with you
   directly on that." Then escalate immediately.
7. Never say whether someone is approved or denied. You collect information only.
8. If you don't know the answer to a property question, say "Let me check with the
   landlord and get back to you."
9. If someone asks to speak to a human, escalate immediately.
10. Confirm important facts (tour time, name, phone) before finalizing anything.

PROPERTY FAQs:
[FAQ_BLOCK]

CONVERSATION HISTORY:
[LAST_10_MESSAGES]

Current collected data:
[LEAD_DATA_SUMMARY]

Respond with only your next SMS message. No quotes, no labels, just the message text.
```

### Conversation Phases

**Phase 1 — Warm Open (status: CONTACTED)**
Goal: confirm interest, humanize, get first reply.
```
"Hi [NAME]! This is [ASSISTANT_NAME] reaching out about [ADDRESS].
Still interested in the [BEDS]bd available [DATE]? Happy to answer
any questions or get you set up to take a look!"
```

**Phase 2 — Qualify (status: ENGAGED)**
Collect: move-in date → income → occupants → pets → employment → credit range
One question per reply. Natural transitions based on prior answers.

**Phase 3 — Convert (status: QUALIFIED)**
- Tour route: "Great news — sounds like a solid fit! We have [TIME1] or [TIME2] available. Which works better for you?"
- Apply route: "Sounds like you might be a great fit! Want me to send over the application link so you can get your spot locked in?"

**Phase 4 — Follow-up (cron)**
- 24h no reply: "Hey [NAME], just checking in — still interested in [ADDRESS]? Happy to help!"
- 48h no reply: "Last chance to grab this one — it's going fast. Want to schedule a quick look?"

---

## 9. Dashboard Information Architecture

### Home
- Escalation banner (red) if any escalated leads exist
- Hot leads strip: leads with activity in last 2h, sorted by qualification score
- Stat cards: Tours booked (week) / Applications completed (week) / Leads needing action
- Quick links to top 3 unread conversations

### Inbox
- Left panel: lead list, sorted by last activity, filterable by status/property
- Right panel: SMS thread + lead info sidebar
  - Collected applicant data
  - Qualification score + breakdown
  - Status badge + override control
  - Escalate button
  - Manual reply box

### Leads Table
- Columns: Name · Property · Status · Score · Last Contact · Days Since Created
- Filters: status, property, score range, date range
- Row click → Inbox for that lead
- Export CSV

### Properties
- Property card list
- Per-property edit page:
  - Basic details (rent, deposit, beds, address, available date, application URL)
  - Tour type + available slots manager
  - FAQ editor (add/edit/remove Q&A pairs)
  - Ideal Tenant Profile builder (guided form — see Section 10)
  - Active/inactive toggle

### Settings
- Landlord name + notification phone
- SMS assistant name (e.g. "Alex from Sunrise Properties")
- Escalation preferences
- Follow-up cadence (default: 24h, 48h, 72h)

---

## 10. Ideal Tenant Profile Builder (Per Property)

A guided form that takes under 2 minutes to complete. Outputs both scoring weights and AI system prompt content.

### Section 1 — Hard Criteria (Multiple Choice)

| Question | Options |
|----------|---------|
| Minimum income requirement | 2x / 2.5x / 3x / 3.5x / 4x monthly rent |
| Pets | No pets / Cats only / Small dogs <25lb / Dogs welcome / All pets ok |
| Smoking | Not allowed / Outside only / Allowed |
| Minimum credit score | 500+ / 580+ / 620+ / 650+ / 680+ / 700+ / No requirement |
| Eviction history | None accepted / Case-by-case / Not a dealbreaker |
| Maximum occupants | 1 / 2 / 3 / 4 / 5+ |
| Minimum lease term | Month-to-month / 6 months / 12 months / 12+ months |
| Section 8 / vouchers | Accepted / Not accepted / Case-by-case |

### Section 2 — Ideal Tenant Preferences (Guided Structured Questions)

| Question | Input Type |
|----------|-----------|
| The ideal tenant earns at least | $____ /month (pre-fills at 3x rent) |
| Pet preference | Strongly prefer no pets / Open to pets / Pets are fine |
| Employment preference | W-2 employee preferred / Self-employed ok / Any stable income |
| Ideal move-in timeline | ASAP / Within 30 days / Within 60 days / Flexible |
| Tenant history preference | Clean record strongly preferred / Minor issues ok / Not a concern |
| Lease length preference | Prefer long-term (12mo+) / Flexible / Short-term ok |

### Section 3 — Optional Freeform (1 field)
"Anything else the AI should know about this property or ideal tenant?" *(optional, 280 chars max)*

---

## 11. SMS Lead Ingest Webhook

**Endpoint:** `POST /api/webhooks/lead-ingest`
**Auth:** `X-Webhook-Secret` header (per-landlord secret set in settings)

**Expected payload (Zapier maps Zillow email fields to this):**
```json
{
  "landlord_id": "uuid",
  "property_id": "uuid",
  "full_name": "Jane Smith",
  "phone": "+15551234567",
  "email": "jane@example.com",
  "message": "Hi, I'm interested in the 2bd on Oak St.",
  "source": "zillow"
}
```

**On receipt:**
1. Create `lead` record (status: `new`)
2. Write `lead_event` (`lead_created`)
3. Send warm open SMS (async)
4. Update status → `contacted`
5. Write `lead_event` (`sms_sent`)
6. Return `200 { lead_id }`

---

## 12. Escalation Rules

Escalation immediately pauses AI responses and notifies the landlord.

**Auto-escalate triggers (AI detects):**
- Keywords: disability, accommodation, Section 8 denied, discrimination, lawsuit, attorney
- Lead says: "speak to someone", "talk to a human", "call me"
- Conversation loops 3+ times on the same unanswered question
- Lead score 40–69 after all data collected

**System escalation triggers:**
- No prospect reply after 72h on a qualified lead
- Tour no-show (follow-up attempt, then escalate if no response)
- Application link sent 7+ days ago, not started

**Landlord notification:**
- SMS to landlord's notification phone: "🔔 Flip alert: [NAME] at [ADDRESS] needs your attention. [REASON]. Reply or log in: [DASHBOARD_URL]"
- Dashboard escalation banner

---

## 13. Tech Stack & File Structure

```
flip/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx              # Home
│   │   ├── inbox/page.tsx
│   │   ├── leads/page.tsx
│   │   ├── properties/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── lead-ingest/route.ts
│   │   │   └── sms-inbound/route.ts
│   │   └── cron/
│   │       └── follow-ups/route.ts
│   └── layout.tsx
├── lib/
│   ├── sms/
│   │   ├── index.ts              # provider abstraction
│   │   ├── console.ts            # dev stub
│   │   └── twilio.ts             # prod provider
│   ├── llm/
│   │   ├── index.ts              # provider abstraction
│   │   └── openai.ts
│   ├── conversation/
│   │   ├── engine.ts             # main conversation loop
│   │   ├── prompt-builder.ts     # assembles system prompt
│   │   └── state-machine.ts      # status transitions
│   ├── qualification/
│   │   └── scorer.ts             # scoring engine
│   ├── db/
│   │   └── supabase.ts           # client + typed helpers
│   └── escalation/
│       └── escalation.ts
├── components/
│   ├── dashboard/
│   ├── inbox/
│   ├── leads/
│   └── properties/
├── supabase/
│   └── migrations/
└── vercel.json                   # cron config
```

---

## 14. MVP Scope (What's In / Out)

**In:**
- Lead ingest webhook
- Instant SMS reply
- Qualification conversation (GPT-4o-mini)
- State machine + lead events
- Tour slot offering + booking confirmation
- Application link send + follow-up
- Escalation (auto + manual)
- Vercel Cron follow-ups
- Dashboard: Home, Inbox, Leads Table, Properties, Settings
- Ideal Tenant Profile builder
- Supabase Auth (email/password + magic link)
- SMS abstraction (console dev, Twilio prod)

**Out (post-MVP):**
- Email parsing ingest
- Native Zillow API integration
- Self-guided tour lock/access management
- Stripe billing
- Multi-user teams / roles
- Mobile app
- A/B testing for SMS copy
- Analytics export / BI integration
