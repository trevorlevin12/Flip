'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewPropertyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [rent, setRent] = useState('')
  const [deposit, setDeposit] = useState('')
  const [bedrooms, setBedrooms] = useState('2')
  const [bathrooms, setBathrooms] = useState('1')
  const [availableDate, setAvailableDate] = useState('')
  const [applicationUrl, setApplicationUrl] = useState('')
  const [tourType, setTourType] = useState('in-person')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const db = getBrowserClient()

    // Get current user's landlord
    const { data: { user } } = await db.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }

    const { data: landlord } = await db
      .from('landlords')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!landlord) { setError('Landlord profile not found'); setSaving(false); return }

    const { data, error: err } = await db.from('properties').insert({
      landlord_id:    landlord.id,
      name,
      address,
      rent_amount:    Math.round(parseFloat(rent) * 100),
      deposit_amount: Math.round(parseFloat(deposit) * 100),
      bedrooms:       parseInt(bedrooms),
      bathrooms:      parseFloat(bathrooms),
      available_date: availableDate,
      application_url: applicationUrl || null,
      tour_type:      tourType,
      faq:            [],
      is_active:      true,
    }).select().single()

    if (err) {
      setError(err.message)
    } else {
      router.push(`/properties/${data.id}`)
    }
    setSaving(false)
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Property</h1>
      <form onSubmit={handleCreate}>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Property name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Oak Street 2BD" required />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Oak St, Portland OR 97201" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Monthly rent ($)</Label>
                <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="2000" required min="1" />
              </div>
              <div className="space-y-1.5">
                <Label>Deposit ($)</Label>
                <Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="2000" required min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Bedrooms</Label>
                <Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} required min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Bathrooms</Label>
                <Input type="number" step="0.5" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} required min="1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Available date</Label>
              <Input type="date" value={availableDate} onChange={(e) => setAvailableDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tour type</Label>
              <Select value={tourType} onValueChange={(v) => v != null && setTourType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-person">In-person</SelectItem>
                  <SelectItem value="self-guided">Self-guided</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Application URL <span className="text-gray-400">(optional)</span></Label>
              <Input value={applicationUrl} onChange={(e) => setApplicationUrl(e.target.value)} placeholder="https://..." />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? 'Creating…' : 'Create property'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
