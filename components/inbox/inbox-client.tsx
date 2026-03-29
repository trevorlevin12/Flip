'use client'

import { useState, useEffect } from 'react'
import { getBrowserClient } from '@/lib/db/client'
import type { LeadWithProperty, Message } from '@/lib/types'
import { STATUS_LABELS } from '@/lib/conversation/state-machine'
import { formatDistanceToNow, format } from 'date-fns'
import { AlertTriangle, Search, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  escalated:             'bg-red-100 text-red-700 border-red-200',
  qualified:             'bg-emerald-100 text-emerald-700 border-emerald-200',
  tour_booked:           'bg-blue-100 text-blue-700 border-blue-200',
  tour_proposed:         'bg-amber-100 text-amber-700 border-amber-200',
  application_sent:      'bg-purple-100 text-purple-700 border-purple-200',
  application_started:   'bg-purple-100 text-purple-700 border-purple-200',
  application_completed: 'bg-gray-100 text-gray-600 border-gray-200',
  engaged:               'bg-sky-100 text-sky-700 border-sky-200',
  contacted:             'bg-gray-100 text-gray-500 border-gray-200',
  new:                   'bg-gray-100 text-gray-400 border-gray-200',
  unqualified:           'bg-red-50 text-red-400 border-red-100',
  closed_lost:           'bg-gray-50 text-gray-400 border-gray-100',
}

const SCORE_COLOR = (score: number) =>
  score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-500'

export default function InboxClient({
  leads,
  initialFilter,
  initialLeadId,
}: {
  leads: LeadWithProperty[]
  initialFilter?: string
  initialLeadId?: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(initialFilter ?? 'all')
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId ?? leads[0]?.id ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [liveLeads, setLiveLeads] = useState(leads)

  const selectedLead = liveLeads.find((l) => l.id === selectedId)

  // Load messages when lead selected
  useEffect(() => {
    if (!selectedId) return
    const db = getBrowserClient()
    db.from('messages')
      .select('*')
      .eq('lead_id', selectedId)
      .order('sent_at', { ascending: true })
      .then(({ data }) => setMessages(data ?? []))

    // Realtime subscription for new messages
    const channel = db
      .channel(`messages:${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `lead_id=eq.${selectedId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { db.removeChannel(channel) }
  }, [selectedId])

  // Realtime lead updates
  useEffect(() => {
    const db = getBrowserClient()
    const channel = db
      .channel('leads-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'leads',
      }, (payload) => {
        setLiveLeads((prev) =>
          prev.map((l) => l.id === payload.new.id ? { ...l, ...payload.new } : l)
        )
      })
      .subscribe()
    return () => { db.removeChannel(channel) }
  }, [])

  const filteredLeads = liveLeads.filter((l) => {
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'escalated' ? l.is_escalated :
      filter === 'active' ? !['closed_lost', 'unqualified', 'application_completed'].includes(l.status) :
      l.status === filter
    const matchesSearch =
      !search ||
      l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search) ||
      l.properties.address.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="flex h-full">
      {/* Lead list panel */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        {/* Search + filter */}
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads…"
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['all', 'escalated', 'active', 'tour_booked', 'application_sent'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full border transition-colors',
                  filter === f
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'text-gray-500 border-gray-200 hover:border-gray-300'
                )}
              >
                {f === 'all' ? 'All' :
                 f === 'escalated' ? '🔴 Escalated' :
                 f === 'active' ? 'Active' :
                 (STATUS_LABELS as Record<string, string>)[f] ?? f}
              </button>
            ))}
          </div>
        </div>

        {/* Lead list */}
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filteredLeads.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-gray-400">No leads found</li>
          )}
          {filteredLeads.map((lead) => (
            <li key={lead.id}>
              <button
                onClick={() => setSelectedId(lead.id)}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                  selectedId === lead.id && 'bg-emerald-50 border-r-2 border-emerald-500'
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-gray-900 truncate flex-1">
                    {lead.full_name ?? lead.phone}
                    {lead.is_escalated && (
                      <AlertTriangle className="inline h-3.5 w-3.5 text-red-500 ml-1" />
                    )}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {lead.updated_at ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true }) : ''}
                  </span>
                </div>
                <div className="text-xs text-gray-500 truncate mb-1.5">{lead.properties.address}</div>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full border font-medium', STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-500')}>
                    {STATUS_LABELS[lead.status]}
                  </span>
                  {lead.qualification_score > 0 && (
                    <span className={cn('text-xs font-semibold', SCORE_COLOR(lead.qualification_score))}>
                      {lead.qualification_score}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Message thread + sidebar */}
      {selectedLead ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Thread */}
          <div className="flex-1 flex flex-col bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedLead.full_name ?? selectedLead.phone}</h2>
                  <p className="text-sm text-gray-500">{selectedLead.phone} · {selectedLead.properties.address}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm',
                      msg.direction === 'outbound'
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-sm'
                    )}
                  >
                    <p>{msg.body}</p>
                    <p className={cn('text-xs mt-1', msg.direction === 'outbound' ? 'text-emerald-100' : 'text-gray-400')}>
                      {format(new Date(msg.sent_at), 'h:mma')}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                  <MessageCircle className="h-8 w-8" />
                  <p className="text-sm">No messages yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Lead info sidebar */}
          <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Status</h3>
              <span className={cn('text-sm px-2.5 py-1 rounded-full border font-medium', STATUS_COLORS[selectedLead.status])}>
                {STATUS_LABELS[selectedLead.status]}
              </span>
              {selectedLead.is_escalated && selectedLead.escalation_reason && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {selectedLead.escalation_reason}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Qualification</h3>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', selectedLead.qualification_score >= 70 ? 'bg-emerald-500' : selectedLead.qualification_score >= 40 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${selectedLead.qualification_score}%` }}
                  />
                </div>
                <span className={cn('text-sm font-bold', SCORE_COLOR(selectedLead.qualification_score))}>
                  {selectedLead.qualification_score}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Applicant Info</h3>
              <dl className="space-y-2">
                <InfoRow label="Name" value={selectedLead.full_name} />
                <InfoRow label="Phone" value={selectedLead.phone} />
                <InfoRow label="Email" value={selectedLead.email} />
                <InfoRow label="Move-in" value={selectedLead.move_in_date} />
                <InfoRow label="Occupants" value={selectedLead.occupant_count?.toString()} />
                <InfoRow label="Pets" value={selectedLead.has_pets == null ? undefined : selectedLead.has_pets ? (selectedLead.pet_description ?? 'Yes') : 'No'} />
                <InfoRow label="Income" value={selectedLead.monthly_income ? `$${(selectedLead.monthly_income / 100).toLocaleString()}/mo` : undefined} />
                <InfoRow label="Employment" value={selectedLead.employment_status} />
                <InfoRow label="Credit range" value={selectedLead.credit_range} />
                <InfoRow label="Eviction" value={selectedLead.has_eviction == null ? undefined : selectedLead.has_eviction ? 'Yes' : 'No'} />
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Timeline</h3>
              <dl className="space-y-1.5">
                <InfoRow label="Lead created" value={selectedLead.created_at ? format(new Date(selectedLead.created_at), 'MMM d, h:mma') : undefined} />
                <InfoRow label="First reply" value={selectedLead.first_reply_at ? format(new Date(selectedLead.first_reply_at), 'MMM d, h:mma') : undefined} />
                <InfoRow label="Last contact" value={selectedLead.last_contacted_at ? formatDistanceToNow(new Date(selectedLead.last_contacted_at), { addSuffix: true }) : undefined} />
              </dl>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p>Select a conversation</p>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <dt className="text-xs text-gray-400 w-24 shrink-0">{label}</dt>
      <dd className="text-xs text-gray-800 break-words">{value}</dd>
    </div>
  )
}
