import type { Message, TextChannel } from 'discord.js'
import { runAgent } from '../brain/agent'
import { getState, setState } from '../state/heartbeat'
import { log } from '../utils/log'

export async function handleMention(message: Message) {
  const content = message.content.replace(/<@!?\d+>/g, '').trim()
  if (!content) {
    await message.reply('u pinged me 4 nothing? ok cool. very productive')
    return
  }

  log(`[mention] from ${message.author.username}: "${content}"`)

  const channel = message.channel as TextChannel
  const recent = await channel.messages.fetch({ limit: 10 })
  const chatLog = recent
    .reverse()
    .map(m => `${m.author.username}: ${m.content}`)
    .join('\n')

  const recentResponses = await getState<string[]>('recent.mention_responses', [])
  const antiRepeat = recentResponses.length > 0
    ? `\nDo NOT repeat or rephrase these recent responses: ${recentResponses.slice(-5).map(r => `"${r}"`).join(', ')}`
    : ''

  const acquisitionCtx = await getState<string | null>('acquisition.context', null)

  const prompt = `Chat log:\n${chatLog}\n\n${message.author.username} (discord ID: ${message.author.id}) just said: "${content}"\n\nReply to what they said. Be specific to their words.${antiRepeat}`

  const response = await runAgent(prompt, undefined, acquisitionCtx ?? undefined)

  recentResponses.push(response)
  if (recentResponses.length > 20) recentResponses.shift()
  await setState('recent.mention_responses', recentResponses)

  await message.reply(response)
  log(`[mention] replied: "${response}"`)
}
