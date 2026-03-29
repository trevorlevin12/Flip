import type { SMSProvider } from './index'

export class ConsoleSMS implements SMSProvider {
  async send(to: string, body: string): Promise<{ sid: string }> {
    const sid = `console_${Date.now()}`
    console.log('\n📱 [SMS]', { to, body, sid })
    return { sid }
  }
}
