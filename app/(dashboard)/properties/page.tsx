import { redirect } from 'next/navigation'
import { getServerClient, getAdminClient } from '@/lib/db/client'
import { getLandlordByUserId, getPropertiesByLandlord } from '@/lib/db/queries'
import Link from 'next/link'
import { format } from 'date-fns'
import { Plus, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function PropertiesPage() {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const landlord = await getLandlordByUserId(db, user.id)
  if (!landlord) redirect('/onboarding')

  const adminDb = getAdminClient()
  const properties = await getPropertiesByLandlord(adminDb, landlord.id)

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
        <Link href="/properties/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1.5" />
            Add property
          </Button>
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-700 mb-1">No properties yet</h2>
          <p className="text-sm text-gray-400 mb-5">Add your first property to start converting Zillow leads.</p>
          <Link href="/properties/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1.5" />
              Add property
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="block bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-sm transition-all p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{property.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{property.address}</p>
                  <div className="flex gap-4 mt-3 text-sm text-gray-600">
                    <span>${(property.rent_amount / 100).toLocaleString()}/mo</span>
                    <span>{property.bedrooms}bd / {property.bathrooms}ba</span>
                    <span>Available {format(new Date(property.available_date), 'MMM d')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${property.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {property.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-400 capitalize">{property.tour_type}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
