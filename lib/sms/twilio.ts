import type { SMSProvider } from './index'

export class TwilioSMS implements SMSProvider {
  private client: ReturnType<typeof import('twilio')>
  private from: string

  constructor() {
    const twilio = require('twilio')
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
    this.from = process.env.TWILIO_PHONE_NUMBER!
  }

  async send(to: string, body: string): Promise<{ sid: string }> {
    const message = await this.client.messages.create({ to, from: this.from, body })
    return { sid: message.sid }
  }
}
