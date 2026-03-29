import { SupabaseClient } from '@supabase/supabase-js'
import type {
  Lead,
  LeadStatus,
  LeadEvent,
  LeadEventType,
  Message,
  Property,
  PropertyWithCriteria,
  QualificationCriteria,
  TourSlot,
  Landlord,
  LeadWithProperty,
} from '@/lib/types'

// ─── Landlords ────────────────────────────────────────────────────────────────

export async function getLandlordByUserId(
  db: SupabaseClient,
  userId: string
): Promise<Landlord | null> {
  const { data } = await db
    .from('landlords')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function getLandlordById(
  db: SupabaseClient,
  landlordId: string
): Promise<Landlord | null> {
  const { data } = await db
    .from('landlords')
    .select('*')
    .eq('id', landlordId)
    .single()
  return data
}

// ─── Properties ───────────────────────────────────────────────────────────────

export async function getPropertiesByLandlord(
  db: SupabaseClient,
  landlordId: string
): Promise<Property[]> {
  const { data } = await db
    .from('properties')
    .select('*')
    .eq('landlord_id', landlordId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getPropertyById(
  db: SupabaseClient,
  propertyId: string
): Promise<PropertyWithCriteria | null> {
  const { data } = await db
    .from('properties')
    .select('*, qualification_criteria(*)')
    .eq('id', propertyId)
    .single()
  return data
}

export async function upsertQualificationCriteria(
  db: SupabaseClient,
  criteria: Omit<QualificationCriteria, 'id' | 'created_at' | 'updated_at'>
): Promise<void> {
  await db
    .from('qualification_criteria')
    .upsert({ ...criteria, updated_at: new Date().toISOString() }, { onConflict: 'property_id' })
}

// ─── Tour Slots ───────────────────────────────────────────────────────────────

export async function getAvailableTourSlots(
  db: SupabaseClient,
  propertyId: string
): Promise<TourSlot[]> {
  const { data } = await db
    .from('tour_slots')
    .select('*')
    .eq('property_id', propertyId)
    .eq('is_booked', false)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(6)
  return data ?? []
}

export async function bookTourSlot(
  db: SupabaseClient,
  slotId: string,
  leadId: string
): Promise<boolean> {
  const { error } = await db
    .from('tour_slots')
    .update({ is_booked: true, lead_id: leadId })
    .eq('id', slotId)
    .eq('is_booked', false)
  return !error
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function createLead(
  db: SupabaseClient,
  lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>
): Promise<Lead> {
  const { data, error } = await db
    .from('leads')
    .insert(lead)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getLeadById(
  db: SupabaseClient,
  leadId: string
): Promise<Lead | null> {
  const { data } = await db.from('leads').select('*').eq('id', leadId).single()
  return data
}

export async function getLeadByPhone(
  db: SupabaseClient,
  phone: string,
  propertyId?: string
): Promise<Lead | null> {
  let query = db.from('leads').select('*').eq('phone', phone)
  if (propertyId) query = query.eq('property_id', propertyId)
  const { data } = await query
    .not('status', 'in', '(closed_lost,unqualified)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function updateLead(
  db: SupabaseClient,
  leadId: string,
  updates: Partial<Lead>
): Promise<Lead> {
  const { data, error } = await db
    .from('leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getLeadsForDashboard(
  db: SupabaseClient,
  landlordId: string
): Promise<LeadWithProperty[]> {
  const { data } = await db
    .from('leads')
    .select('*, properties!inner(*)')
    .eq('properties.landlord_id', landlordId)
    .order('updated_at', { ascending: false })
  return (data as LeadWithProperty[]) ?? []
}

export async function getLeadsNeedingFollowUp(
  db: SupabaseClient
): Promise<LeadWithProperty[]> {
  const now = new Date()
  const { data } = await db
    .from('leads')
    .select('*, properties!inner(*)')
    .in('status', ['contacted', 'tour_proposed', 'application_sent'])
    .eq('is_escalated', false)
    .lte('last_contacted_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
  return (data as LeadWithProperty[]) ?? []
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function createMessage(
  db: SupabaseClient,
  message: Omit<Message, 'id'>
): Promise<Message> {
  const { data, error } = await db
    .from('messages')
    .insert(message)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMessagesByLead(
  db: SupabaseClient,
  leadId: string,
  limit = 20
): Promise<Message[]> {
  const { data } = await db
    .from('messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('sent_at', { ascending: true })
    .limit(limit)
  return data ?? []
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function logLeadEvent(
  db: SupabaseClient,
  leadId: string,
  eventType: LeadEventType,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await db.from('lead_events').insert({
    lead_id: leadId,
    event_type: eventType,
    payload,
    created_at: new Date().toISOString(),
  })
}

export async function getEventsByLead(
  db: SupabaseClient,
  leadId: string
): Promise<LeadEvent[]> {
  const { data } = await db
    .from('lead_events')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  return data ?? []
}
