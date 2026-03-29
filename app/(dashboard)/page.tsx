import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/db/client'
import { getAdminClient } from '@/lib/db/client'
import { getLandlordByUserId, getLeadsForDashboard } from '@/lib/db/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS } from '@/lib/conversation/state-machine'
import type { LeadWithProperty } from '@/lib/types'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, CalendarCheck, FileText, Zap } from 'lucide-react'

export default async function DashboardPage() {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const landlord = await getLandlordByUserId(db, user.id)
  if (!landlord) redirect('/onboarding')

  const adminDb = getAdminClient()
  const leads = await getLeadsForDashboard(adminDb, landlord.id)

  // Compute stats
  const now = Date.now()
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
  const twoHoursAgo = now - 2 * 60 * 60 * 1000

  const toursBooked    = leads.filter((l) => ['tour_booked', 'application_sent', 'application_started', 'application_completed'].includes(l.status) && new Date(l.updated_at).getTime() > oneWeekAgo).length
  const appsCompleted  = leads.filter((l) => l.status === 'application_completed' && new Date(l.updated_at).getTime() > oneWeekAgo).length
  const escalated      = leads.filter((l) => l.is_escalated)
  const needsAction    = leads.filter((l) => l.is_escalated || l.status === 'tour_proposed').length
  const hotLeads       = leads
    .filter((l) => new Date(l.updated_at).getTime() > twoHoursAgo && l.status !== 'closed_lost' && l.status !== 'unqualified')
    .sort((a, b) => b.qualification_score - a.qualification_score)
    .slice(0, 5)

  return (
    <div className="p-8 max-w-6xl">
      {/* Escalation banner */}
      {escalated.length > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <span className="font-medium text-red-700">{escalated.length} lead{escalated.length > 1 ? 's' : ''} need your attention</span>
            <span className="text-red-600 text-sm ml-2">— these conversations are paused until you respond.</span>
          </div>
          <Link href="/inbox?filter=escalated" className="text-sm font-medium text-red-700 hover:underline">
            Review
          </Link>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Tours Booked (7d)"
          value={toursBooked}
          icon={<CalendarCheck className="h-5 w-5 text-emerald-600" />}
        />
        <StatCard
          label="Apps Completed (7d)"
          value={appsCompleted}
          icon={<FileText className="h-5 w-5 text-blue-600" />}
        />
        <StatCard
          label="Needs Action"
          value={needsAction}
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          highlight={needsAction > 0}
        />
      </div>

      {/* Hot leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-700">Active in Last 2 Hours</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {hotLeads.length === 0 ? (
            <p className="text-sm text-gray-500 px-6 pb-6">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {hotLeads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, icon, highlight = false }: {
  label: string
  value: number
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-amber-200 bg-amber-50' : ''}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-500">{label}</span>
          {icon}
        </div>
        <div className="text-3xl font-bold text-gray-900">{value}</div>
      </CardContent>
    </Card>
  )
}

function LeadRow({ lead }: { lead: LeadWithProperty }) {
  const statusColors: Record<string, string> = {
    escalated:              'bg-red-100 text-red-700',
    qualified:              'bg-emerald-100 text-emerald-700',
    tour_booked:            'bg-blue-100 text-blue-700',
    tour_proposed:          'bg-amber-100 text-amber-700',
    application_sent:       'bg-purple-100 text-purple-700',
    application_started:    'bg-purple-100 text-purple-700',
    application_completed:  'bg-gray-100 text-gray-600',
    engaged:                'bg-sky-100 text-sky-700',
    contacted:              'bg-gray-100 text-gray-600',
  }
  const colorClass = statusColors[lead.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <li>
      <Link href={`/inbox/${lead.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm truncate">
              {lead.full_name ?? lead.phone}
            </span>
            {lead.is_escalated && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">{lead.properties.address}</div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
          {STATUS_LABELS[lead.status]}
        </span>
        <span className="text-xs text-gray-400 shrink-0">
          {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
        </span>
        {lead.qualification_score > 0 && (
          <span className="text-xs font-medium text-gray-500 w-8 text-right">
            {lead.qualification_score}
          </span>
        )}
      </Link>
    </li>
  )
}
