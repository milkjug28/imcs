import { gemini, type GeminiContent, type GeminiPart } from './rotator'
import { AGENT_TOOLS } from './tools'
import { executeTool } from './executor'
import { buildSystemPrompt } from './system-prompt'
import { sanitize } from '../data/wallet'
import { log, logError } from '../utils/log'

const MAX_ITERATIONS = 3

export interface ImageAttachment {
  mimeType: string
  base64: string
}

export async function runAgent(
  prompt: string,
  extraContext?: string,
  acquisitionContext?: string,
  images?: ImageAttachment[],
): Promise<string> {
  const systemInstruction = buildSystemPrompt(extraContext, acquisitionContext)

  const userParts: GeminiPart[] = [{ text: prompt }]
  if (images && images.length > 0) {
    for (const img of images) {
      userParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
    }
  }

  const contents: GeminiContent[] = [
    { role: 'user', parts: userParts },
  ]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const isLastIteration = i === MAX_ITERATIONS - 1

    try {
      const { response, model } = await gemini.callWithTools(
        contents,
        systemInstruction,
        isLastIteration ? [] : AGENT_TOOLS,
      )

      const parts = response.candidates?.[0]?.content?.parts
      if (!parts || parts.length === 0) {
        logError('[agent] empty response', new Error(`iteration ${i}`))
        break
      }

      const functionCalls = parts.filter((p: GeminiPart) => p.functionCall)
      const textParts = parts.filter((p: GeminiPart) => p.text)

      if (functionCalls.length === 0) {
        const text = textParts.map((p: GeminiPart) => p.text).join(' ').trim()
        if (text) {
          const safe = sanitize(text)
          if (!safe) {
            log(`[agent] gibberish filtered, dropping response`)
            break
          }
          log(`[agent] responded via ${model} (${i + 1} iterations): "${safe.slice(0, 80)}..."`)
          return safe
        }
        break
      }

      // Execute all function calls in parallel
      contents.push({
        role: 'model',
        parts: functionCalls.map((p: GeminiPart) => ({
          functionCall: p.functionCall,
        })),
      })

      const results = await Promise.all(
        functionCalls.map(async (p: GeminiPart) => {
          const { name, args } = p.functionCall!
          const result = await executeTool(name, args || {})
          return { name, result }
        }),
      )

      contents.push({
        role: 'user',
        parts: results.map(({ name, result }) => ({
          functionResponse: {
            name,
            response: { data: result } as Record<string, unknown>,
          },
        })),
      })

      log(`[agent] iteration ${i + 1}: called ${results.map(r => r.name).join(', ')}`)
    } catch (err) {
      logError(`[agent] iteration ${i} failed`, err)
      break
    }
  }

  return 'brain not braining rn. try agen l8r dummie'
}
