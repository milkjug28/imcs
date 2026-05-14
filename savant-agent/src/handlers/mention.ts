import type { Message, TextChannel } from 'discord.js'
import { runAgent, type ImageAttachment } from '../brain/agent'
import { getState, setState } from '../state/heartbeat'
import { log } from '../utils/log'

const recentResponsesCache: string[] = []

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

async function extractImages(message: Message): Promise<ImageAttachment[]> {
  const images: ImageAttachment[] = []
  for (const [, att] of message.attachments) {
    if (!att.contentType || !IMAGE_TYPES.has(att.contentType)) continue
    if (images.length >= 2) break
    try {
      const res = await fetch(att.url)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      images.push({ mimeType: att.contentType, base64: buf.toString('base64') })
      log(`[mention] extracted image: ${att.name} (${att.contentType})`)
    } catch { /* skip */ }
  }
  return images
}

export async function handleMention(message: Message) {
  const content = message.content.replace(/<@!?\d+>/g, '').trim()

  const images = await extractImages(message)

  if (!content && images.length === 0) {
    await message.reply('u pinged me 4 nothing? ok cool. very productive')
    return
  }

  log(`[mention] from ${message.author.username}: "${content}"${images.length > 0 ? ` (+${images.length} images)` : ''}`)

  const channel = message.channel as TextChannel
  const recent = await channel.messages.fetch({ limit: 10 })
  const chatLog = recent
    .reverse()
    .map(m => {
      const imgCount = m.attachments.filter(a => a.contentType && IMAGE_TYPES.has(a.contentType)).size
      const imgNote = imgCount > 0 ? ` [${imgCount} image(s) attached]` : ''
      return `${m.author.username}: ${m.content}${imgNote}`
    })
    .join('\n')

  const antiRepeat = recentResponsesCache.length > 0
    ? `\nDo NOT repeat or rephrase these recent responses: ${recentResponsesCache.slice(-5).map(r => `"${r}"`).join(', ')}`
    : ''

  const acquisitionCtx = await getState<string | null>('acquisition.context', null)

  const imageNote = images.length > 0 ? ' (they attached an image - describe what you see and react to it)' : ''
  const prompt = `Chat log:\n${chatLog}\n\n${message.author.username} (discord ID: ${message.author.id}) just said: "${content}"${imageNote}\n\nReply to what they said. Be specific to their words.${antiRepeat}`

  const response = await runAgent(prompt, undefined, acquisitionCtx ?? undefined, images)

  recentResponsesCache.push(response)
  if (recentResponsesCache.length > 20) recentResponsesCache.shift()
  setState('recent.mention_responses', recentResponsesCache).catch(() => {})

  await message.reply(response)
  log(`[mention] replied: "${response}"`)
}
