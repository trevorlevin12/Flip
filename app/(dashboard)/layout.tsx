import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/db/client'
import { getLandlordByUserId } from '@/lib/db/queries'
import DashboardNav from '@/components/dashboard/nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) redirect('/login')

  const landlord = await getLandlordByUserId(db, user.id)

  // First time user — prompt to set up their account
  if (!landlord) {
    redirect('/onboarding')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DashboardNav landlordName={landlord.name} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
