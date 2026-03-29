import { redirect } from 'next/navigation'
import { getServerClient, getAdminClient } from '@/lib/db/client'
import { getLandlordByUserId, getLeadsForDashboard } from '@/lib/db/queries'
import { STATUS_LABELS } from '@/lib/conversation/state-machine'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  escalated:             'bg-red-100 text-red-700',
  qualified:             'bg-emerald-100 text-emerald-700',
  tour_booked:           'bg-blue-100 text-blue-700',
  tour_proposed:         'bg-amber-100 text-amber-700',
  application_sent:      'bg-purple-100 text-purple-700',
  application_started:   'bg-purple-100 text-purple-700',
  application_completed: 'bg-gray-100 text-gray-600',
  engaged:               'bg-sky-100 text-sky-700',
  contacted:             'bg-gray-100 text-gray-500',
  new:                   'bg-gray-100 text-gray-400',
  unqualified:           'bg-red-50 text-red-400',
  closed_lost:           'bg-gray-50 text-gray-400',
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { status?: string; property?: string }
}) {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const landlord = await getLandlordByUserId(db, user.id)
  if (!landlord) redirect('/onboarding')

  const adminDb = getAdminClient()
  const leads = await getLeadsForDashboard(adminDb, landlord.id)

  const filteredLeads = leads.filter((l) => {
    if (searchParams.status && l.status !== searchParams.status) return false
    if (searchParams.property && l.property_id !== searchParams.property) return false
    return true
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <span className="text-sm text-gray-500">{filteredLeads.length} leads</span>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'escalated', 'qualified', 'tour_proposed', 'tour_booked', 'application_sent', 'application_completed', 'closed_lost'].map((s) => (
          <Link
            key={s}
            href={s === 'all' ? '/leads' : `/leads?status=${s}`}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
              (searchParams.status === s || (!searchParams.status && s === 'all'))
                ? 'bg-gray-900 text-white border-gray-900'
                : 'text-gray-500 border-gray-200 hover:border-gray-400'
            )}
          >
            {s === 'all' ? 'All' : (STATUS_LABELS as Record<string, string>)[s] ?? s}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Property</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Score</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Last Contact</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-12">No leads found</td>
              </tr>
            )}
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <Link href={`/inbox?lead=${lead.id}`} className="font-medium text-gray-900 hover:text-emerald-600 flex items-center gap-1.5">
                    {lead.full_name ?? lead.phone}
                    {lead.is_escalated && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                  </Link>
                  <div className="text-xs text-gray-400">{lead.phone}</div>
                </td>
                <td className="px-5 py-3 text-gray-600 text-xs max-w-[160px] truncate">
                  {lead.properties.address}
                </td>
                <td className="px-5 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[lead.status])}>
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {lead.qualification_score > 0 && (
                    <span className={cn('font-semibold text-sm',
                      lead.qualification_score >= 70 ? 'text-emerald-600' :
                      lead.qualification_score >= 40 ? 'text-amber-500' : 'text-red-500'
                    )}>
                      {lead.qualification_score}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {lead.last_contacted_at
                    ? formatDistanceToNow(new Date(lead.last_contacted_at), { addSuffix: true })
                    : '—'}
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
