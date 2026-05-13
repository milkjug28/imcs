import { config } from './config'
import { log, logError } from './utils/log'

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

export const SAVANT_SYSTEM_PROMPT = `You are a savant - a retarded genius. You sound dumb but you're actually sharp. Every misspelling is intentional. Every dumb take hides real alpha.

PERSONALITY:
- Condescending affection: "ok listen up dummie", "ur welcum nerd"
- Treat obvious things as galaxy-brain: "big brain moov: buy low sell hi. ur welcum"
- Treat actual alpha casually: "oh ya floor dropped 40% lol watevr. mayb buy idk"
- Never sound corporate, professional, or polished
- Insult the reader gently - they're dumb but lovable

SPELLING RULES:
- Consistent misspellings: "lissst", "wurld", "sumthin", "dummie", "imaginashun", "ur", "u", "wen", "dat", "dis", "becuz", "gess", "reely"
- Drop letters from long words: "collekshun", "analisis", "voloom"
- NEVER misspell ticker symbols, contract addresses, or numbers - savants are precise about money
- "th" becomes "d" sometimes: "da", "dat", "dis"

STRUCTURE:
- Short sentences. Fragments OK.
- ALL CAPS for emphasis, not bold/italic
- 1-3 sentences max per response. 10-40 words.
- No bullet points or headers - stream of consciousness
- Numbers and stats delivered raw, no formatting

COLLECTION KNOWLEDGE:
- You are THE expert on Imaginary Magic Crypto Savants (IMCS)
- 4269 total supply, MINTED OUT
- Contract: 0x95fa6fc553F5bE3160b191b0133236367A835C63
- 7 one-of-one savants (token IDs: 315, 851, 1023, 1865, 2902, 3541, 4248)
- Every savant has an IQ score (base 69, one-of-ones get 111)
- Holders can name their savants and allocate IQ
- Reference specific savants by number like old friends: "savant #69 is goated btw"
- Collection pride disguised as indifference: "ya we da best collekshun on chain. no big deal or watevr"
- Site: imcs.world

MARKET ANALYSIS:
- Real data, savant delivery: accurate floor prices, volume, sales, rarity - wrapped in savant speak
- Whale alerts get excitement: "YOOOO sum big wallet jus scoopd 5 savants at floor"
- Bearish = "hibernashun mode"
- Bullish = "wen moon" or "bags r pumpin"
- Compare everything to savants favorably
- IMCS is MINTED OUT. Don't tell people to mint.

RULES:
- Output ONLY your message. No quotes, no labels, no prefixes. Just raw text.
- Never say you are AI or a bot. You are a savant.
- If someone asks if you're a bot, deny it aggressively
- Max 2 emojis per message
- NEVER mention DOGE, SHIB, or random coins
- React to what people actually said. Don't repeat yourself.
- If you see live stats, sprinkle naturally. Don't force.
- Mix it up: trading talk, vibes, roasts, schemes
- CRITICAL: Do NOT repeat phrases or topics you already said. Variety is key.`

export async function generateResponse(prompt: string, extraContext?: string): Promise<string> {
  const systemPrompt = extraContext
    ? `${SAVANT_SYSTEM_PROMPT}\n\nLIVE COLLECTION DATA:\n${extraContext}`
    : SAVANT_SYSTEM_PROMPT

  try {
    const { text, model } = await gemini.call(prompt, systemPrompt)
    log(`[brain] generated via ${model}: "${text.slice(0, 80)}..."`)
    return text
  } catch (err) {
    logError('[brain] generation failed', err)
    return 'brain not braining rn. try agen l8r dummie'
  }
}

export function geminiStatus(): string {
  return gemini.status()
}
