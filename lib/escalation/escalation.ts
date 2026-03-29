// Keywords that trigger immediate escalation + AI halt
const ESCALATION_KEYWORDS = [
  // Fair housing / legal
  'disability', 'disabled', 'wheelchair', 'accommodation', 'service animal',
  'section 8 denied', 'discrimination', 'discriminate', 'fair housing',
  'lawsuit', 'attorney', 'lawyer', 'sue', 'legal action',
  // Human escalation request
  'speak to someone', 'speak with someone', 'talk to a person', 'talk to a human',
  'call me', 'real person', 'human please', 'manager', 'supervisor',
  // Frustration signals
  'this is ridiculous', 'forget it', 'never mind', 'scam', 'bot',
]

export interface EscalationCheck {
  shouldEscalate: boolean
  reason?: string
}

export function checkMessageForEscalation(message: string): EscalationCheck {
  const lower = message.toLowerCase()
  for (const keyword of ESCALATION_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        shouldEscalate: true,
        reason: `Keyword detected: "${keyword}"`,
      }
    }
  }
  return { shouldEscalate: false }
}

export function buildLandlordEscalationSMS(
  leadName: string | null,
  propertyAddress: string,
  reason: string,
  dashboardUrl: string
): string {
  const name = leadName ?? 'a prospect'
  return `LeasePilot: ${name} at ${propertyAddress} needs your attention. ${reason}. Log in: ${dashboardUrl}`
}

export function buildStuckLeadEscalationMessage(
  leadName: string | null,
  propertyAddress: string,
  stuckFor: string,
  dashboardUrl: string
): string {
  const name = leadName ?? 'A prospect'
  return `LeasePilot: ${name} at ${propertyAddress} has been stuck for ${stuckFor} without a reply. Check in: ${dashboardUrl}`
}
