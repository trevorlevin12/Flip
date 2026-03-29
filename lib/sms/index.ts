export interface SMSProvider {
  send(to: string, body: string): Promise<{ sid: string }>
}

export interface SMSInboundPayload {
  from: string       // E.164 phone number
  to: string
  body: string
  sid?: string
}

let _provider: SMSProvider | null = null

export function getSMSProvider(): SMSProvider {
  if (_provider) return _provider

  const type = process.env.SMS_PROVIDER ?? 'console'

  if (type === 'twilio') {
    const { TwilioSMS } = require('./twilio')
    _provider = new TwilioSMS()
  } else {
    const { ConsoleSMS } = require('./console')
    _provider = new ConsoleSMS()
  }

  return _provider!
}

export async function sendSMS(to: string, body: string): Promise<{ sid: string }> {
  return getSMSProvider().send(to, body)
}
