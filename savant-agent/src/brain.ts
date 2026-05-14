import { gemini } from './brain/rotator'
import { SAVANT_SYSTEM_PROMPT } from './brain/system-prompt'
import { sanitize } from './data/wallet'
import { log, logError } from './utils/log'

export { SAVANT_SYSTEM_PROMPT } from './brain/system-prompt'
export { gemini, GeminiRotator } from './brain/rotator'

export async function generateResponse(prompt: string, extraContext?: string): Promise<string> {
  const systemPrompt = extraContext
    ? `${SAVANT_SYSTEM_PROMPT}\n\nLIVE COLLECTION DATA:\n${extraContext}`
    : SAVANT_SYSTEM_PROMPT

  try {
    const { text, model } = await gemini.call(prompt, systemPrompt)
    const safe = sanitize(text)
    log(`[brain] generated via ${model}: "${safe.slice(0, 80)}..."`)
    return safe
  } catch (err) {
    logError('[brain] generation failed', err)
    return 'brain not braining rn. try agen l8r dummie'
  }
}

export function geminiStatus(): string {
  return gemini.status()
}
