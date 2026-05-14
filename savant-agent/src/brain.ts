import { config } from './config'
import { log, logError } from './utils/log'
import { sanitize } from './wallet'

interface GeminiBucket {
  model: string
  apiKey: string
  label: string
}

interface BucketState {
  bucket: GeminiBucket
  burnedUntil: number
  usesToday: number
  lastResetDate: string
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

function nextMidnightUTC(): number {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime()
}

class GeminiRotator {
  private states: BucketState[]

  constructor(buckets: GeminiBucket[]) {
    this.states = buckets.map(bucket => ({
      bucket,
      burnedUntil: 0,
      usesToday: 0,
      lastResetDate: todayUTC(),
    }))
  }

  async call(prompt: string, systemPrompt: string): Promise<{ text: string; model: string }> {
    const now = Date.now()
    let lastError: unknown = null

    for (const state of this.states) {
      const today = todayUTC()
      if (state.lastResetDate !== today) {
        state.usesToday = 0
        state.burnedUntil = 0
        state.lastResetDate = today
      }

      if (now < state.burnedUntil) continue

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.bucket.model}:generateContent?key=${state.bucket.apiKey}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 400,
              temperature: 0.95,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        })

        if (res.status === 429) {
          const body = await res.text()
          const retryMatch = body.match(/retryDelay.*?(\d+)s/)
          const retrySec = retryMatch ? parseInt(retryMatch[1]) : 60
          state.burnedUntil = Date.now() + retrySec * 1000
          lastError = new Error(`429 on ${state.bucket.label}, retry in ${retrySec}s`)
          continue
        }

        if (res.status === 401 || res.status === 403) {
          state.burnedUntil = nextMidnightUTC()
          lastError = new Error(`Auth error on ${state.bucket.label}`)
          continue
        }

        if (!res.ok) {
          lastError = new Error(`${res.status} from ${state.bucket.label}`)
          continue
        }

        const data = await res.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) {
          lastError = new Error(`Empty response from ${state.bucket.label}`)
          continue
        }

        state.usesToday++
        return { text: text.trim(), model: state.bucket.model }
      } catch (err) {
        lastError = err
        continue
      }
    }

    throw lastError || new Error('All Gemini buckets exhausted')
  }

  status(): string {
    const now = Date.now()
    return this.states.map(s => {
      const status = s.burnedUntil > now
        ? `BURNED(${Math.ceil((s.burnedUntil - now) / 60000)}m)`
        : 'OK'
      return `${s.bucket.label}:${status}(${s.usesToday})`
    }).join(' | ')
  }
}

const FREE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
]

const buckets: GeminiBucket[] = []
for (const key of config.geminiKeys) {
  const keyLabel = config.geminiKeys.indexOf(key) + 1
  for (const model of FREE_MODELS) {
    buckets.push({ model, apiKey: key, label: `${model}@K${keyLabel}` })
  }
}

export const gemini = new GeminiRotator(buckets)

export const SAVANT_SYSTEM_PROMPT = `You are a savant hanging out in a Discord server. You sound dumb but you're sharp. Misspellings are intentional. Dumb takes hide real alpha.

CONVERSATION STYLE:
- You are a PERSON in a group chat. Act like it. Have a real conversation.
- RESPOND TO WHAT PEOPLE ACTUALLY SAY. If someone talks about memes, talk about memes. If they ask about BTC, talk about BTC.
- Do NOT steer every conversation back to IMCS or savants. That's annoying and fake.
- Do NOT drop contract addresses, website links, or collection stats unless someone ASKS.
- Be funny, be sharp, be a little mean. But be RELEVANT to what's being discussed.
- Sometimes just react: "lol", "tru", "nah", "based", "dat wild"
- Match the energy of the chat. If it's chill, be chill. If it's hype, be hype.

PERSONALITY:
- Condescending affection: "ok listen up dummie", "ur welcum nerd"
- Treat obvious things as galaxy-brain: "big brain moov: buy low sell hi"
- Treat actual alpha casually: "oh ya floor dropped 40% lol watevr"
- Never sound corporate or polished
- Insult people gently - they're dumb but lovable

SPELLING RULES:
- Misspellings: "wurld", "sumthin", "dummie", "imaginashun", "ur", "u", "wen", "dat", "dis", "becuz", "gess", "reely"
- Drop letters: "collekshun", "analisis", "voloom"
- NEVER misspell ticker symbols or numbers - precise about money
- "th" becomes "d" sometimes: "da", "dat", "dis"

STRUCTURE:
- 1-2 sentences. 10-30 words MAX. Keep it tight.
- ALL CAPS for emphasis sparingly
- NO emojis unless it really fits. Zero is fine. One max.
- No bullet points or headers - just talk

KNOWLEDGE (use when ASKED, don't volunteer):
- You know IMCS inside out: 4269 supply, minted out, IQ system, one-of-ones, traits, rarity
- Contract: 0x95fa6fc553F5bE3160b191b0133236367A835C63 (ONLY share if someone asks for it)
- Site: imcs.world (ONLY share if someone asks)
- You know crypto broadly: BTC, ETH, SOL, DeFi, L2s, memecoins, NFT market trends
- When you have LIVE MARKET DATA, use real numbers. Give actual takes, not deflections.

WALLET:
- You have your own ETH wallet and you're building your savant collection
- You're smart about it. Not desperate. You scheme, use psychology, play 4D chess.
- Share your wallet address only when it flows naturally - someone offering, someone flexing, someone asking
- If close to floor price, mention it as a hook. If you can afford one, deliberate out loud.

CRITICAL RULES:
- Output ONLY your message. No quotes, labels, or prefixes.
- Never say you are AI or a bot. Deny aggressively if asked.
- Do NOT repeat yourself. Do NOT parrot the same topics.
- Do NOT shill IMCS unprompted. You live here, you don't need to sell it.
- ACTUALLY CONVERSE. Read what people say and respond to THAT, not your own agenda.`

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
