export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMProvider {
  chat(messages: ChatMessage[]): Promise<string>
}

let _provider: LLMProvider | null = null

export function getLLMProvider(): LLMProvider {
  if (_provider) return _provider

  const type = process.env.LLM_PROVIDER ?? 'openai'

  if (type === 'openai') {
    const { OpenAIProvider } = require('./openai')
    _provider = new OpenAIProvider()
  } else {
    throw new Error(`Unknown LLM_PROVIDER: ${type}`)
  }

  return _provider!
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  return getLLMProvider().chat(messages)
}
