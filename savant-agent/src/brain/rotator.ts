import { config } from '../config'
import { log, logError } from '../utils/log'

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

export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  functionCall?: { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: Record<string, unknown> }
}

export interface GeminiResponse {
  candidates?: {
    content?: { role: string; parts: GeminiPart[] }
    finishReason?: string
  }[]
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

function nextMidnightUTC(): number {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime()
}

// ── OpenRouter adapter (OpenAI format <-> Gemini format) ────────────

const OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash:free'
const OPENROUTER_VISION_MODEL = 'google/gemma-4-27b-it:free'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
  name?: string
}

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

function geminiToOpenAI(
  contents: GeminiContent[],
  systemInstruction: string,
  geminiTools: unknown[],
): { messages: OpenAIMessage[]; tools: OpenAITool[] } {
  const messages: OpenAIMessage[] = [{ role: 'system', content: systemInstruction }]
  let toolCallCounter = 0

  for (const c of contents) {
    const role = c.role === 'model' ? 'assistant' as const : 'user' as const

    const textParts = c.parts.filter(p => p.text)
    const fcParts = c.parts.filter(p => p.functionCall)
    const frParts = c.parts.filter(p => p.functionResponse)

    if (fcParts.length > 0) {
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: fcParts.map(p => ({
          id: `call_${toolCallCounter++}`,
          type: 'function' as const,
          function: {
            name: p.functionCall!.name,
            arguments: JSON.stringify(p.functionCall!.args || {}),
          },
        })),
      })
    } else if (frParts.length > 0) {
      for (const p of frParts) {
        messages.push({
          role: 'tool',
          tool_call_id: `call_${toolCallCounter - frParts.length + frParts.indexOf(p)}`,
          content: JSON.stringify(p.functionResponse!.response),
        })
      }
    } else {
      const imageParts = c.parts.filter(p => p.inlineData)
      if (textParts.length > 0 || imageParts.length > 0) {
        if (imageParts.length > 0) {
          const contentBlocks: unknown[] = []
          for (const p of textParts) {
            contentBlocks.push({ type: 'text', text: p.text })
          }
          for (const p of imageParts) {
            contentBlocks.push({
              type: 'image_url',
              image_url: { url: `data:${p.inlineData!.mimeType};base64,${p.inlineData!.data}` },
            })
          }
          messages.push({ role, content: contentBlocks as unknown as string })
        } else {
          messages.push({ role, content: textParts.map(p => p.text).join(' ') })
        }
      }
    }
  }

  const tools: OpenAITool[] = []
  for (const toolGroup of geminiTools) {
    const group = toolGroup as { functionDeclarations?: unknown[] }
    if (group.functionDeclarations) {
      for (const fd of group.functionDeclarations) {
        const decl = fd as { name: string; description: string; parameters: Record<string, unknown> }
        tools.push({
          type: 'function',
          function: {
            name: decl.name,
            description: decl.description,
            parameters: convertGeminiParams(decl.parameters),
          },
        })
      }
    }
  }

  return { messages, tools }
}

function convertGeminiParams(params: Record<string, unknown>): Record<string, unknown> {
  if (!params) return { type: 'object', properties: {} }

  const result: Record<string, unknown> = {
    type: (params.type as string || 'object').toLowerCase(),
  }

  if (params.properties) {
    const props: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(params.properties as Record<string, unknown>)) {
      const prop = val as Record<string, unknown>
      props[key] = {
        type: (prop.type as string || 'string').toLowerCase(),
        description: prop.description,
      }
    }
    result.properties = props
  } else {
    result.properties = {}
  }

  if (params.required) {
    result.required = params.required
  }

  return result
}

function openAIToGemini(data: Record<string, unknown>): GeminiResponse {
  const choices = data.choices as { message: Record<string, unknown> }[] | undefined
  if (!choices || choices.length === 0) return { candidates: [] }

  const msg = choices[0].message
  const parts: GeminiPart[] = []

  if (msg.tool_calls) {
    const toolCalls = msg.tool_calls as { function: { name: string; arguments: string } }[]
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(tc.function.arguments) } catch { /* empty */ }
      parts.push({ functionCall: { name: tc.function.name, args } })
    }
  }

  if (msg.content) {
    parts.push({ text: msg.content as string })
  }

  if (parts.length === 0) {
    parts.push({ text: '' })
  }

  return {
    candidates: [{
      content: { role: 'model', parts },
      finishReason: 'STOP',
    }],
  }
}

async function callOpenRouter(
  contents: GeminiContent[],
  systemInstruction: string,
  tools: unknown[],
): Promise<{ response: GeminiResponse; model: string }> {
  const { messages, tools: oaiTools } = geminiToOpenAI(contents, systemInstruction, tools)

  const hasImages = contents.some(c => c.parts.some(p => p.inlineData))
  const model = hasImages ? OPENROUTER_VISION_MODEL : OPENROUTER_MODEL

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: 400,
    temperature: 0.95,
  }

  if (oaiTools.length > 0) {
    body.tools = oaiTools
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openRouterKey}`,
      'HTTP-Referer': 'https://imcs.world',
      'X-Title': 'savant-agent',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as Record<string, unknown>
  const geminiResponse = openAIToGemini(data)

  log(`[rotator] openrouter ok (${model})`)
  return { response: geminiResponse, model: `openrouter/${model}` }
}

async function callOpenRouterSimple(
  prompt: string,
  systemPrompt: string,
): Promise<{ text: string; model: string }> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openRouterKey}`,
      'HTTP-Referer': 'https://imcs.world',
      'X-Title': 'savant-agent',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 400,
      temperature: 0.95,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as Record<string, unknown>
  const choices = data.choices as { message: { content: string } }[]
  const text = choices?.[0]?.message?.content
  if (!text) throw new Error('Empty OpenRouter response')

  log(`[rotator] openrouter ok (${OPENROUTER_MODEL})`)
  return { text: text.trim(), model: `openrouter/${OPENROUTER_MODEL}` }
}

// ── GeminiRotator with OpenRouter fallback ──────────────────────────

export class GeminiRotator {
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

    // Fallback to OpenRouter
    if (config.openRouterKey) {
      try {
        log('[rotator] all Gemini buckets exhausted, falling back to OpenRouter')
        return await callOpenRouterSimple(prompt, systemPrompt)
      } catch (err) {
        logError('[rotator] OpenRouter fallback failed', err)
      }
    }

    throw lastError || new Error('All Gemini buckets exhausted')
  }

  async callWithTools(
    contents: GeminiContent[],
    systemInstruction: string,
    tools: unknown[],
  ): Promise<{ response: GeminiResponse; model: string }> {
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

        const body: Record<string, unknown> = {
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.95,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }

        if (tools.length > 0) {
          body.tools = tools
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (res.status === 429) {
          const rawBody = await res.text()
          const retryMatch = rawBody.match(/retryDelay.*?(\d+)s/)
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

        const data = await res.json() as GeminiResponse
        if (!data?.candidates?.[0]?.content?.parts) {
          lastError = new Error(`Empty response from ${state.bucket.label}`)
          continue
        }

        state.usesToday++
        log(`[rotator] ${state.bucket.label} ok (${state.usesToday} today)`)
        return { response: data, model: state.bucket.model }
      } catch (err) {
        lastError = err
        continue
      }
    }

    // Fallback to OpenRouter
    if (config.openRouterKey) {
      try {
        log('[rotator] all Gemini buckets exhausted, falling back to OpenRouter')
        return await callOpenRouter(contents, systemInstruction, tools)
      } catch (err) {
        logError('[rotator] OpenRouter fallback failed', err)
      }
    }

    throw lastError || new Error('All buckets exhausted (Gemini + OpenRouter)')
  }

  status(): string {
    const now = Date.now()
    const parts = this.states.map(s => {
      const status = s.burnedUntil > now
        ? `BURNED(${Math.ceil((s.burnedUntil - now) / 60000)}m)`
        : 'OK'
      return `${s.bucket.label}:${status}(${s.usesToday})`
    })
    if (config.openRouterKey) parts.push('OpenRouter:READY')
    return parts.join(' | ')
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
