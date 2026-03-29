-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Landlords ─────────────────────────────────────────────────────────────────
create table landlords (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  assistant_name     text not null default 'Alex',
  notification_phone text,
  notification_email text,
  escalation_prefs   jsonb not null default '{"notify_sms": true, "notify_email": false}'::jsonb,
  created_at         timestamptz not null default now(),
  unique(user_id)
);

alter table landlords enable row level security;
create policy "Landlords own their row" on landlords
  for all using (auth.uid() = user_id);

-- ── Properties ────────────────────────────────────────────────────────────────
create table properties (
  id               uuid primary key default uuid_generate_v4(),
  landlord_id      uuid not null references landlords(id) on delete cascade,
  name             text not null,
  address          text not null,
  rent_amount      integer not null check (rent_amount > 0),   -- cents
  target_rent_min  integer not null default 0,                 -- cents
  deposit_amount   integer not null default 0,                 -- cents
  bedrooms         integer not null default 1,
  bathrooms        numeric(3,1) not null default 1.0,
  available_date   date not null,
  application_url  text,
  tour_type        text not null default 'in-person' check (tour_type in ('in-person','self-guided','both')),
  faq              jsonb not null default '[]'::jsonb,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table properties enable row level security;
create policy "Landlords own their properties" on properties
  for all using (
    landlord_id in (select id from landlords where user_id = auth.uid())
  );

-- ── Qualification Criteria ────────────────────────────────────────────────────
create table qualification_criteria (
  id                          uuid primary key default uuid_generate_v4(),
  property_id                 uuid not null references properties(id) on delete cascade,
  income_multiple             numeric(4,2) not null default 3.0,
  income_min_monthly          integer not null default 0,            -- cents
  pet_policy                  text not null default 'none'
    check (pet_policy in ('none','cats_only','small_dogs','dogs_ok','all_ok')),
  pet_preference              text not null default 'strongly_prefer_none'
    check (pet_preference in ('strongly_prefer_none','open','fine')),
  smoking_policy              text not null default 'not_allowed'
    check (smoking_policy in ('not_allowed','outside_only','allowed')),
  min_credit_score            integer,
  eviction_policy             text not null default 'none_accepted'
    check (eviction_policy in ('none_accepted','case_by_case','not_concern')),
  max_occupants               integer,
  min_lease_months            integer not null default 12,
  voucher_policy              text not null default 'not_accepted'
    check (voucher_policy in ('accepted','not_accepted','case_by_case')),
  employment_preference       text not null default 'any_stable'
    check (employment_preference in ('w2_preferred','self_employed_ok','any_stable')),
  move_in_preference          text not null default 'flexible'
    check (move_in_preference in ('asap','30_days','60_days','flexible')),
  tenant_history_preference   text not null default 'clean_strongly'
    check (tenant_history_preference in ('clean_strongly','minor_ok','flexible')),
  lease_length_preference     text not null default 'long_term'
    check (lease_length_preference in ('long_term','flexible','short_ok')),
  additional_notes            text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique(property_id)
);

alter table qualification_criteria enable row level security;
create policy "Landlords own criteria via properties" on qualification_criteria
  for all using (
    property_id in (
      select p.id from properties p
      join landlords l on l.id = p.landlord_id
      where l.user_id = auth.uid()
    )
  );

-- ── Tour Slots ────────────────────────────────────────────────────────────────
create table tour_slots (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references properties(id) on delete cascade,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  is_booked    boolean not null default false,
  lead_id      uuid,  -- FK added after leads table
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);

alter table tour_slots enable row level security;
create policy "Landlords own tour slots via properties" on tour_slots
  for all using (
    property_id in (
      select p.id from properties p
      join landlords l on l.id = p.landlord_id
      where l.user_id = auth.uid()
    )
  );

-- ── Leads ─────────────────────────────────────────────────────────────────────
create table leads (
  id                   uuid primary key default uuid_generate_v4(),
  property_id          uuid not null references properties(id) on delete cascade,
  status               text not null default 'new'
    check (status in (
      'new','contacted','engaged','qualified','unqualified',
      'tour_proposed','tour_booked','application_sent',
      'application_started','application_completed',
      'escalated','closed_lost'
    )),
  qualification_score  integer not null default 0,
  is_escalated         boolean not null default false,
  escalation_reason    text,
  -- Contact
  full_name            text,
  phone                text not null,
  email                text,
  source               text not null default 'zillow',
  -- Applicant data
  move_in_date         date,
  occupant_count       integer,
  has_pets             boolean,
  pet_description      text,
  monthly_income       integer,             -- cents
  employment_status    text,
  credit_range         text,
  has_eviction         boolean,
  eviction_context     text,
  ready_to_apply       boolean,
  -- Timestamps
  created_at           timestamptz not null default now(),
  last_contacted_at    timestamptz,
  first_reply_at       timestamptz,
  updated_at           timestamptz not null default now()
);

-- Add FK from tour_slots now that leads table exists
alter table tour_slots
  add constraint tour_slots_lead_id_fkey
  foreign key (lead_id) references leads(id) on delete set null;

alter table leads enable row level security;
create policy "Landlords own leads via properties" on leads
  for all using (
    property_id in (
      select p.id from properties p
      join landlords l on l.id = p.landlord_id
      where l.user_id = auth.uid()
    )
  );

-- Allow service role to bypass (for webhook processing)
-- (handled by using admin client in API routes)

-- ── Messages ──────────────────────────────────────────────────────────────────
create table messages (
  id         uuid primary key default uuid_generate_v4(),
  lead_id    uuid not null references leads(id) on delete cascade,
  direction  text not null check (direction in ('inbound','outbound')),
  channel    text not null default 'sms',
  body       text not null,
  sent_at    timestamptz not null default now(),
  metadata   jsonb not null default '{}'::jsonb
);

alter table messages enable row level security;
create policy "Landlords own messages via leads" on messages
  for all using (
    lead_id in (
      select l.id from leads l
      join properties p on p.id = l.property_id
      join landlords lo on lo.id = p.landlord_id
      where lo.user_id = auth.uid()
    )
  );

-- ── Lead Events ───────────────────────────────────────────────────────────────
create table lead_events (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references leads(id) on delete cascade,
  event_type  text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table lead_events enable row level security;
create policy "Landlords own events via leads" on lead_events
  for all using (
    lead_id in (
      select l.id from leads l
      join properties p on p.id = l.property_id
      join landlords lo on lo.id = p.landlord_id
      where lo.user_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index leads_property_id_idx on leads(property_id);
create index leads_status_idx on leads(status);
create index leads_phone_idx on leads(phone);
create index leads_updated_at_idx on leads(updated_at desc);
create index messages_lead_id_idx on messages(lead_id);
create index messages_sent_at_idx on messages(sent_at);
create index lead_events_lead_id_idx on lead_events(lead_id);
create index tour_slots_property_start_idx on tour_slots(property_id, start_time);

-- ── Realtime ──────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table messages;
