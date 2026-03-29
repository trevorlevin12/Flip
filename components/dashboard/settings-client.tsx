'use client'

import { useState } from 'react'
import type { Landlord } from '@/lib/types'
import { getBrowserClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function SettingsClient({ landlord }: { landlord: Landlord }) {
  const [name, setName] = useState(landlord.name)
  const [assistantName, setAssistantName] = useState(landlord.assistant_name)
  const [notificationPhone, setNotificationPhone] = useState(landlord.notification_phone ?? '')
  const [notificationEmail, setNotificationEmail] = useState(landlord.notification_email ?? '')
  const [notifySms, setNotifySms] = useState(landlord.escalation_prefs?.notify_sms ?? true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    const db = getBrowserClient()

    const { error } = await db
      .from('landlords')
      .update({
        name,
        assistant_name:    assistantName,
        notification_phone: notificationPhone || null,
        notification_email: notificationEmail || null,
        escalation_prefs: { notify_sms: notifySms, notify_email: !!notificationEmail },
      })
      .eq('id', landlord.id)

    if (error) {
      setSaveMsg('Error: ' + error.message)
    } else {
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(''), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Your Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Your name / business name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pacific Properties" required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Assistant</CardTitle>
            <p className="text-sm text-gray-500 mt-1">This is the name prospects see in SMS messages.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assistant name</Label>
              <Input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} placeholder="Alex" required />
              <p className="text-xs text-gray-400">e.g. "Alex from Pacific Properties"</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalation Notifications</CardTitle>
            <p className="text-sm text-gray-500 mt-1">How Flip reaches you when a lead needs human attention.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Your phone (for SMS alerts)</Label>
              <Input
                type="tel"
                value={notificationPhone}
                onChange={(e) => setNotificationPhone(e.target.value)}
                placeholder="+15035551234"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Your email <span className="text-gray-400">(optional)</span></Label>
              <Input
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notify_sms"
                checked={notifySms}
                onChange={(e) => setNotifySms(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600"
              />
              <Label htmlFor="notify_sms">Send me an SMS when a lead is escalated</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook Setup</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Use this endpoint with Zapier or Make to send Zillow leads into Flip.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Lead ingest endpoint</Label>
              <code className="block text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 select-all">
                POST {typeof window !== 'undefined' ? window.location.origin : 'https://yourapp.vercel.app'}/api/webhooks/lead-ingest
              </code>
            </div>
            <div className="space-y-1.5">
              <Label>Required header</Label>
              <code className="block text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700">
                X-Webhook-Secret: {'<your WEBHOOK_SECRET env var>'}
              </code>
            </div>
            <p className="text-xs text-gray-400">
              Set <code className="bg-gray-100 px-1 rounded">WEBHOOK_SECRET</code> and <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code> in your Vercel environment variables.
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          {saveMsg && (
            <span className={`text-sm ${saveMsg.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
