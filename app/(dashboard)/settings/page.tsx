import { redirect } from 'next/navigation'
import { getServerClient, getAdminClient } from '@/lib/db/client'
import { getLandlordByUserId } from '@/lib/db/queries'
import SettingsClient from '@/components/dashboard/settings-client'

export default async function SettingsPage() {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const landlord = await getLandlordByUserId(db, user.id)
  if (!landlord) redirect('/onboarding')

  return <SettingsClient landlord={landlord} />
}
