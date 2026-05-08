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
              maxOutputTokens: 200,
              temperature: 0.9,
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
        return { text, model: state.bucket.model }
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

const keys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[]

const buckets: GeminiBucket[] = []
for (const key of keys) {
  const keyLabel = keys.indexOf(key) + 1
  for (const model of FREE_MODELS) {
    buckets.push({
      model,
      apiKey: key,
      label: `${model}@K${keyLabel}`,
    })
  }
}

export const geminiRotator = new GeminiRotator(buckets)
