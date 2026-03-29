import { redirect, notFound } from 'next/navigation'
import { getServerClient, getAdminClient } from '@/lib/db/client'
import { getLandlordByUserId, getPropertyById } from '@/lib/db/queries'
import PropertyEditClient from '@/components/properties/property-edit-client'

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const landlord = await getLandlordByUserId(db, user.id)
  if (!landlord) redirect('/onboarding')

  const adminDb = getAdminClient()
  const property = await getPropertyById(adminDb, params.id)

  if (!property || property.landlord_id !== landlord.id) notFound()

  return <PropertyEditClient property={property} landlordId={landlord.id} />
}
