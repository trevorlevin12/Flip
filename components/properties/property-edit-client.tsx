'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PropertyWithCriteria, QualificationCriteria, FAQ, TourSlot } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getBrowserClient } from '@/lib/db/client'
import { Plus, Trash2, Save } from 'lucide-react'

export default function PropertyEditClient({
  property,
  landlordId,
}: {
  property: PropertyWithCriteria
  landlordId: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Property basics state
  const [name, setName] = useState(property.name)
  const [address, setAddress] = useState(property.address)
  const [rent, setRent] = useState(String(property.rent_amount / 100))
  const [deposit, setDeposit] = useState(String(property.deposit_amount / 100))
  const [bedrooms, setBedrooms] = useState(String(property.bedrooms))
  const [bathrooms, setBathrooms] = useState(String(property.bathrooms))
  const [availableDate, setAvailableDate] = useState(property.available_date)
  const [applicationUrl, setApplicationUrl] = useState(property.application_url ?? '')
  const [tourType, setTourType] = useState(property.tour_type)
  const [isActive, setIsActive] = useState(property.is_active)

  // FAQ state
  const [faqs, setFaqs] = useState<FAQ[]>(property.faq)

  // Qualification criteria state
  const crit = property.qualification_criteria
  const [incomeMult, setIncomeMult] = useState(String(crit?.income_multiple ?? 3))
  const [petPolicy, setPetPolicy] = useState(crit?.pet_policy ?? 'none')
  const [smokingPolicy, setSmokingPolicy] = useState(crit?.smoking_policy ?? 'not_allowed')
  const [evictionPolicy, setEvictionPolicy] = useState(crit?.eviction_policy ?? 'none_accepted')
  const [maxOccupants, setMaxOccupants] = useState(String(crit?.max_occupants ?? ''))
  const [minLease, setMinLease] = useState(String(crit?.min_lease_months ?? 12))
  const [minCredit, setMinCredit] = useState(String(crit?.min_credit_score ?? ''))
  const [voucherPolicy, setVoucherPolicy] = useState(crit?.voucher_policy ?? 'not_accepted')
  const [moveInPref, setMoveInPref] = useState(crit?.move_in_preference ?? 'flexible')
  const [employmentPref, setEmploymentPref] = useState(crit?.employment_preference ?? 'any_stable')
  const [tenantHistoryPref, setTenantHistoryPref] = useState(crit?.tenant_history_preference ?? 'clean_strongly')
  const [additionalNotes, setAdditionalNotes] = useState(crit?.additional_notes ?? '')

  async function saveProperty() {
    setSaving(true)
    setSaveMsg('')
    const db = getBrowserClient()

    const { error } = await db.from('properties').update({
      name,
      address,
      rent_amount:     Math.round(parseFloat(rent) * 100),
      deposit_amount:  Math.round(parseFloat(deposit) * 100),
      bedrooms:        parseInt(bedrooms),
      bathrooms:       parseFloat(bathrooms),
      available_date:  availableDate,
      application_url: applicationUrl || null,
      tour_type:       tourType,
      faq:             faqs,
      is_active:       isActive,
    }).eq('id', property.id)

    if (error) {
      setSaveMsg('Error saving property: ' + error.message)
    } else {
      // Upsert qualification criteria
      const criteriaPayload = {
        property_id:               property.id,
        income_multiple:           parseFloat(incomeMult),
        income_min_monthly:        0,
        pet_policy:                petPolicy,
        pet_preference:            petPolicy === 'none' ? 'strongly_prefer_none' : 'fine',
        smoking_policy:            smokingPolicy,
        min_credit_score:          minCredit ? parseInt(minCredit) : null,
        eviction_policy:           evictionPolicy,
        max_occupants:             maxOccupants ? parseInt(maxOccupants) : null,
        min_lease_months:          parseInt(minLease),
        voucher_policy:            voucherPolicy,
        employment_preference:     employmentPref,
        move_in_preference:        moveInPref,
        tenant_history_preference: tenantHistoryPref,
        lease_length_preference:   'long_term',
        additional_notes:          additionalNotes || null,
        updated_at:                new Date().toISOString(),
      }

      const { error: critError } = await db
        .from('qualification_criteria')
        .upsert(criteriaPayload, { onConflict: 'property_id' })

      if (critError) {
        setSaveMsg('Property saved, but criteria failed: ' + critError.message)
      } else {
        setSaveMsg('Saved!')
        setTimeout(() => setSaveMsg(''), 2000)
      }
    }
    setSaving(false)
  }

  function addFaq() {
    setFaqs([...faqs, { question: '', answer: '' }])
  }

  function updateFaq(i: number, field: 'question' | 'answer', val: string) {
    setFaqs(faqs.map((f, idx) => idx === i ? { ...f, [field]: val } : f))
  }

  function removeFaq(i: number) {
    setFaqs(faqs.filter((_, idx) => idx !== i))
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{property.name || property.address}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{property.address}</p>
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm ${saveMsg.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
              {saveMsg}
            </span>
          )}
          <Button onClick={saveProperty} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basics">
        <TabsList className="mb-6">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="criteria">Ideal Tenant</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
        </TabsList>

        {/* ── Basics ── */}
        <TabsContent value="basics" className="space-y-5">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Property name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Oak Street 2BD" />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Oak St, Portland OR 97201" />
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly rent ($)</Label>
                  <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="2000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Deposit ($)</Label>
                  <Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="2000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bedrooms</Label>
                  <Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} placeholder="2" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bathrooms</Label>
                  <Input type="number" step="0.5" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} placeholder="1" />
                </div>
                <div className="space-y-1.5">
                  <Label>Available date</Label>
                  <Input type="date" value={availableDate} onChange={(e) => setAvailableDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tour type</Label>
                  <Select value={tourType} onValueChange={(v) => setTourType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in-person">In-person</SelectItem>
                      <SelectItem value="self-guided">Self-guided</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Application URL</Label>
                <Input value={applicationUrl} onChange={(e) => setApplicationUrl(e.target.value)} placeholder="https://apply.doorloop.com/..." />
                <p className="text-xs text-gray-400">The link Flip sends when a prospect is ready to apply.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                />
                <Label htmlFor="is_active">Property is active (Flip will respond to leads)</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Ideal Tenant ── */}
        <TabsContent value="criteria" className="space-y-5">
          <p className="text-sm text-gray-500">These settings shape how Flip qualifies applicants and what the AI prioritizes in conversations.</p>

          <Card>
            <CardHeader><CardTitle className="text-base">Hard Requirements</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Minimum income (× rent)</Label>
                  <Select value={incomeMult} onValueChange={(v) => v != null && setIncomeMult(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['2', '2.5', '3', '3.5', '4'].map((v) => (
                        <SelectItem key={v} value={v}>{v}× rent</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Minimum credit score</Label>
                  <Select value={minCredit} onValueChange={(v) => setMinCredit(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="No requirement" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No requirement</SelectItem>
                      {['500', '580', '620', '650', '680', '700'].map((v) => (
                        <SelectItem key={v} value={v}>{v}+</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Pets</Label>
                  <Select value={petPolicy} onValueChange={(v) => v != null && setPetPolicy(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No pets</SelectItem>
                      <SelectItem value="cats_only">Cats only</SelectItem>
                      <SelectItem value="small_dogs">Small dogs (&lt;25lb)</SelectItem>
                      <SelectItem value="dogs_ok">Dogs welcome</SelectItem>
                      <SelectItem value="all_ok">All pets ok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Smoking</Label>
                  <Select value={smokingPolicy} onValueChange={(v) => v != null && setSmokingPolicy(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_allowed">Not allowed</SelectItem>
                      <SelectItem value="outside_only">Outside only</SelectItem>
                      <SelectItem value="allowed">Allowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Eviction history</Label>
                  <Select value={evictionPolicy} onValueChange={(v) => v != null && setEvictionPolicy(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none_accepted">None accepted</SelectItem>
                      <SelectItem value="case_by_case">Case-by-case</SelectItem>
                      <SelectItem value="not_concern">Not a concern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Max occupants</Label>
                  <Select value={maxOccupants} onValueChange={(v) => setMaxOccupants(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="No limit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No limit</SelectItem>
                      {['1','2','3','4','5'].map((v) => (
                        <SelectItem key={v} value={v}>{v} {v === '1' ? 'person' : 'people'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Minimum lease</Label>
                  <Select value={minLease} onValueChange={(v) => v != null && setMinLease(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Month-to-month</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Housing vouchers (Sec. 8)</Label>
                  <Select value={voucherPolicy} onValueChange={(v) => v != null && setVoucherPolicy(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="not_accepted">Not accepted</SelectItem>
                      <SelectItem value="case_by_case">Case-by-case</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Ideal move-in timeline</Label>
                  <Select value={moveInPref} onValueChange={(v) => v != null && setMoveInPref(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asap">ASAP</SelectItem>
                      <SelectItem value="30_days">Within 30 days</SelectItem>
                      <SelectItem value="60_days">Within 60 days</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Employment preference</Label>
                  <Select value={employmentPref} onValueChange={(v) => v != null && setEmploymentPref(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="w2_preferred">W-2 preferred</SelectItem>
                      <SelectItem value="self_employed_ok">Self-employed ok</SelectItem>
                      <SelectItem value="any_stable">Any stable income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Tenant history preference</Label>
                  <Select value={tenantHistoryPref} onValueChange={(v) => v != null && setTenantHistoryPref(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clean_strongly">Clean record strongly preferred</SelectItem>
                      <SelectItem value="minor_ok">Minor issues ok</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Additional notes for the AI <span className="text-gray-400">(optional)</span></Label>
                <Textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="e.g. 'Quiet building, ideal for professionals. No short-term rental use.'"
                  maxLength={280}
                  rows={3}
                />
                <p className="text-xs text-gray-400">{additionalNotes.length}/280 characters</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FAQs ── */}
        <TabsContent value="faqs" className="space-y-4">
          <p className="text-sm text-gray-500">Add common questions and answers. The AI will use these to respond to prospects accurately.</p>
          {faqs.map((faq, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(i, 'question', e.target.value)}
                      placeholder="e.g. Is parking included?"
                    />
                    <Textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                      placeholder="e.g. Yes, one assigned parking spot is included with rent."
                      rows={2}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFaq(i)}
                    className="text-gray-400 hover:text-red-500 mt-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addFaq} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add FAQ
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}
