'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [assistantName, setAssistantName] = useState('Alex')
  const [notificationPhone, setNotificationPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const db = getBrowserClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
      setError('Not signed in')
      setLoading(false)
      return
    }

    const { error: err } = await db.from('landlords').insert({
      user_id:            user.id,
      name,
      assistant_name:     assistantName,
      notification_phone: notificationPhone || null,
      escalation_prefs:   { notify_sms: !!notificationPhone, notify_email: false },
    })

    if (err) {
      setError(err.message)
    } else {
      router.push('/properties/new')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-emerald-600">LeasePilot</span>
          <p className="text-gray-500 mt-2">Let's set up your account — takes 2 minutes.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome! Let's get started.</CardTitle>
            <CardDescription>Tell us a bit about yourself. You can change this anytime in Settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Your name or business name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pacific Properties"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>AI assistant name</Label>
                <Input
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  placeholder="Alex"
                  required
                />
                <p className="text-xs text-gray-400">Prospects will receive SMS from "{assistantName} at {name || 'your company'}"</p>
              </div>
              <div className="space-y-1.5">
                <Label>Your phone number <span className="text-gray-400">(for escalation alerts)</span></Label>
                <Input
                  type="tel"
                  value={notificationPhone}
                  onChange={(e) => setNotificationPhone(e.target.value)}
                  placeholder="+15035551234"
                />
                <p className="text-xs text-gray-400">We'll text you when a lead needs your attention.</p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? 'Setting up…' : 'Continue →'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
