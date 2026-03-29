import { redirect } from 'next/navigation'
import { getServerClient, getAdminClient } from '@/lib/db/client'
import { getLandlordByUserId, getLeadsForDashboard } from '@/lib/db/queries'
import InboxClient from '@/components/inbox/inbox-client'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: { filter?: string; lead?: string }
}) {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const landlord = await getLandlordByUserId(db, user.id)
  if (!landlord) redirect('/onboarding')

  const adminDb = getAdminClient()
  const leads = await getLeadsForDashboard(adminDb, landlord.id)

  return (
    <InboxClient
      leads={leads}
      initialFilter={searchParams.filter}
      initialLeadId={searchParams.lead}
    />
  )
}
