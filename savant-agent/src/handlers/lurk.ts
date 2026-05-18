import type { Client, TextChannel } from 'discord.js'
import { runAgent } from '../brain/agent'
import { getState, setState } from '../state/heartbeat'
import { config } from '../config'
import { log } from '../utils/log'

const MIN_LURK_INTERVAL = 30 * 60_000
const LURK_CHANCE = 0.12
const MIN_MESSAGES_FOR_LURK = 5
const MAX_LURKS_PER_DAY = 6

export async function scanChannels(client: Client) {
  if (config.lurkChannels.length === 0) return

  const today = new Date().toISOString().split('T')[0]
  const lurkCount = await getState<{ date: string; count: number }>('cron.lurk_count', { date: today, count: 0 })
  if (lurkCount.date !== today) {
    lurkCount.date = today
    lurkCount.count = 0
  }
  if (lurkCount.count >= MAX_LURKS_PER_DAY) return

  const lastLurkTimes = await getState<Record<string, number>>('cron.last_lurk_times', {})

  for (const channelId of config.lurkChannels) {
    try {
      const lastLurk = lastLurkTimes[channelId] || 0
      if (Date.now() - lastLurk < MIN_LURK_INTERVAL) continue

      const channel = await client.channels.fetch(channelId)
      if (!channel?.isTextBased()) continue

      const textChannel = channel as TextChannel
      const messages = await textChannel.messages.fetch({ limit: 15 })

      const humanMessages = messages
        .filter(m => !m.author.bot && m.createdTimestamp > lastLurk)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)

      if (humanMessages.size < MIN_MESSAGES_FOR_LURK) continue

      if (Math.random() > LURK_CHANCE) {
        log(`[lurk] skipped ${textChannel.name} (dice roll)`)
        continue
      }

      const chatLog = humanMessages
        .map(m => `${m.author.username} (id:${m.author.id}): ${m.content}`)
        .join('\n')

      const recentLurkResponses = await getState<string[]>('recent.lurk_responses', [])
      const antiRepeat = recentLurkResponses.length > 0
        ? `\nDo NOT repeat or rephrase these: ${recentLurkResponses.slice(-5).map(r => `"${r}"`).join(', ')}`
        : ''

      const prompt = `You've been reading this Discord chat. If something is interesting or you have a real take, respond to a SPECIFIC person about a SPECIFIC thing they said. If nothing stands out, just react short.\n\nTo tag someone, use <@their_id> format (e.g. <@123456789>). Always tag who you're responding to.\n\nRecent chat:\n${chatLog}\n\nPick ONE message to respond to. Be sharp and relevant.${antiRepeat}`

      const acquisitionCtx = await getState<string | null>('acquisition.context', null)
      const response = await runAgent(prompt, undefined, acquisitionCtx ?? undefined)

      recentLurkResponses.push(response)
      if (recentLurkResponses.length > 10) recentLurkResponses.shift()
      await setState('recent.lurk_responses', recentLurkResponses)

      await textChannel.send(response)
      lastLurkTimes[channelId] = Date.now()
      lurkCount.count++
      await setState('cron.last_lurk_times', lastLurkTimes)
      await setState('cron.lurk_count', lurkCount)
      log(`[lurk] posted in ${textChannel.name} (${lurkCount.count}/${MAX_LURKS_PER_DAY} today): "${response}"`)

    } catch (err) {
      log(`[lurk] error in channel ${channelId}: ${err}`)
    }
  }
}
