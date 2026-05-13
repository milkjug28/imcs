import type { Client, TextChannel } from 'discord.js'
import { generateResponse } from '../brain'
import { getCollectionStats } from '../opensea'
import { config } from '../config'
import { log } from '../utils/log'

const lastLurkPerChannel = new Map<string, number>()
const MIN_LURK_INTERVAL = 10 * 60_000 // 10 min minimum between lurks per channel
const LURK_CHANCE = 0.3 // 30% chance to chime in when conditions met
const MIN_MESSAGES_FOR_LURK = 3 // need at least 3 messages in last scan window

const recentLurkResponses: string[] = []
const MAX_LURK_RECENT = 10

function trackLurk(text: string) {
  recentLurkResponses.push(text)
  if (recentLurkResponses.length > MAX_LURK_RECENT) recentLurkResponses.shift()
}

export async function scanChannels(client: Client) {
  if (config.lurkChannels.length === 0) return

  for (const channelId of config.lurkChannels) {
    try {
      const lastLurk = lastLurkPerChannel.get(channelId) || 0
      if (Date.now() - lastLurk < MIN_LURK_INTERVAL) continue

      const channel = await client.channels.fetch(channelId)
      if (!channel?.isTextBased()) continue

      const textChannel = channel as TextChannel
      const messages = await textChannel.messages.fetch({ limit: 15 })

      // Filter to messages since last lurk, from humans (not bots)
      const humanMessages = messages
        .filter(m => !m.author.bot && m.createdTimestamp > lastLurk)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)

      if (humanMessages.size < MIN_MESSAGES_FOR_LURK) continue

      // Roll dice
      if (Math.random() > LURK_CHANCE) {
        log(`[lurk] skipped ${textChannel.name} (dice roll)`)
        continue
      }

      const chatLog = humanMessages
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n')

      const stats = await getCollectionStats()

      const triggerKeywords = /savant|floor|price|nft|mint|whale|jeet|rug|moon|pump|dump|sell|buy|hold|diamond|paper/i
      const hasRelevantTopic = humanMessages.some(m => triggerKeywords.test(m.content))

      const antiRepeat = recentLurkResponses.length > 0
        ? `\nDo NOT repeat or rephrase these: ${recentLurkResponses.slice(-5).map(r => `"${r}"`).join(', ')}`
        : ''

      let prompt: string
      if (hasRelevantTopic) {
        prompt = `You're lurking in a Discord channel and people are talking about something relevant. Jump in naturally with a savant take.\n\nRecent chat:\n${chatLog}\n\nChime in on what they're discussing. Be relevant to the conversation, don't just say random stuff.${antiRepeat}`
      } else {
        prompt = `You're lurking in a Discord channel. People are chatting about random stuff. Drop a random savant observation or hot take to stir things up.\n\nRecent chat:\n${chatLog}\n\nSay something funny, provocative, or savant-pilled. React to something someone said or just drop wisdom.${antiRepeat}`
      }

      const response = await generateResponse(prompt, stats?.summary)
      trackLurk(response)

      await textChannel.send(response)
      lastLurkPerChannel.set(channelId, Date.now())
      log(`[lurk] posted in ${textChannel.name}: "${response}"`)

    } catch (err) {
      log(`[lurk] error in channel ${channelId}: ${err}`)
    }
  }
}
