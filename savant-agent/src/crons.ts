import type { Client, TextChannel } from 'discord.js'
import { generateResponse, geminiStatus } from './brain'
import { getCollectionStats, getCachedStats, type CollectionStats } from './opensea'
import { getRandomSavant } from './supabase'
import { config } from './config'
import { log } from './utils/log'
import { scanChannels } from './handlers/lurk'

let previousFloor: number | null = null
let previousStats: CollectionStats | null = null

async function getChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  if (!channelId) return null
  try {
    const ch = await client.channels.fetch(channelId)
    return ch?.isTextBased() ? ch as TextChannel : null
  } catch {
    return null
  }
}

// Pick a channel for announcements: alpha channel > first lurk channel > sales channel
async function getAnnouncementChannel(client: Client): Promise<TextChannel | null> {
  return await getChannel(client, config.alphaChannelId)
    || (config.lurkChannels[0] ? await getChannel(client, config.lurkChannels[0]) : null)
    || await getChannel(client, config.salesChannelId)
}

// ── Floor price monitor (every 15 min) ──────────────────────────────

export async function checkFloor(client: Client) {
  const stats = await getCollectionStats()
  if (!stats || stats.floorPrice === 0) return

  if (previousFloor !== null) {
    const change = ((stats.floorPrice - previousFloor) / previousFloor) * 100

    if (Math.abs(change) >= 10) {
      const channel = await getAnnouncementChannel(client)
      if (!channel) return

      const direction = change > 0 ? 'up' : 'down'
      const prompt = `The IMCS floor price just moved ${direction} ${Math.abs(change).toFixed(1)}% from ${previousFloor.toFixed(4)} ETH to ${stats.floorPrice.toFixed(4)} ETH. ${stats.totalListings} listed. React to this as a savant.`
      const response = await generateResponse(prompt, stats.summary)
      await channel.send(response)
      log(`[cron:floor] alert sent: ${change.toFixed(1)}%`)
    }
  }

  previousFloor = stats.floorPrice
}

// ── Whale/jeet monitor (every 10 min) ───────────────────────────────

export async function checkWhales(client: Client) {
  const stats = await getCollectionStats()
  if (!stats) return

  if (previousStats) {
    const newWhales = stats.whales.filter(
      (w: { address: string; count: number }) => !previousStats!.whales.some((pw: { address: string }) => pw.address === w.address)
    )
    const newJeets = stats.jeets.filter(
      (j: { address: string; count: number }) => !previousStats!.jeets.some((pj: { address: string }) => pj.address === j.address)
    )

    if (newWhales.length > 0 || newJeets.length > 0) {
      const channel = await getAnnouncementChannel(client)
      if (!channel) return

      const parts: string[] = []
      if (newWhales.length > 0) {
        parts.push(`New whale(s) spotted buying savants: ${newWhales.map((w: { address: string; count: number }) => `${w.address}(${w.count} buys)`).join(', ')}`)
      }
      if (newJeets.length > 0) {
        parts.push(`Jeet alert: ${newJeets.map((j: { address: string; count: number }) => `${j.address}(${j.count} sells)`).join(', ')}`)
      }

      const prompt = `${parts.join('. ')}. Floor: ${stats.floorPrice.toFixed(4)} ETH. React as a savant.`
      const response = await generateResponse(prompt, stats.summary)
      await channel.send(response)
      log(`[cron:whales] alert: ${newWhales.length} whales, ${newJeets.length} jeets`)
    }
  }

  previousStats = stats
}

// ── Daily alpha (once a day, afternoon UTC) ─────────────────────────

let lastAlphaDate = ''

export async function dailyAlpha(client: Client) {
  const today = new Date().toISOString().split('T')[0]
  if (lastAlphaDate === today) return

  const hour = new Date().getUTCHours()
  if (hour !== 14) return // 2pm UTC

  lastAlphaDate = today

  const channel = await getAnnouncementChannel(client)
  if (!channel) return

  const stats = await getCollectionStats()
  const savant = await getRandomSavant()

  let prompt = 'Give a daily savant alpha report. Cover: floor status, listing count, recent activity, and one hot take or prediction.'
  if (savant) {
    const traits = savant.attributes.map((a: { trait_type: string; value: string }) => `${a.trait_type}: ${a.value}`).join(', ')
    prompt += ` Also shout out savant #${savant.tokenId} (${savant.name}, IQ: ${savant.iq}, traits: ${traits}). Make it a "savant of the day" thing.`
  }

  const response = await generateResponse(prompt, stats?.summary)
  await channel.send(response)
  log(`[cron:alpha] daily alpha posted`)
}

// ── Random wisdom (3-5x per day) ────────────────────────────────────

let wisdomCountToday = 0
let lastWisdomDate = ''
const MAX_WISDOM_PER_DAY = 5

export async function randomWisdom(client: Client) {
  const today = new Date().toISOString().split('T')[0]
  if (lastWisdomDate !== today) {
    wisdomCountToday = 0
    lastWisdomDate = today
  }
  if (wisdomCountToday >= MAX_WISDOM_PER_DAY) return

  // Random chance per check (tuned so ~3-5 fire per day with 30min interval)
  if (Math.random() > 0.12) return

  const channel = await getAnnouncementChannel(client)
  if (!channel) return

  const topics = [
    'Drop random savant wisdom about crypto, NFTs, or life',
    'Make a bold prediction about the NFT market this week',
    'Roast paper hands and hype diamond hands',
    'Say something philosophical but dumb about blockchain',
    'Give unsolicited trading advice that sounds wrong but is right',
    'Compliment a random savant trait combination and explain why its rare',
    'React to the current state of the NFT market with savant energy',
    'Tell people why savants are better than every other collection',
  ]
  const topic = topics[Math.floor(Math.random() * topics.length)]

  const stats = getCachedStats()
  const response = await generateResponse(topic, stats?.summary)
  await channel.send(response)
  wisdomCountToday++
  log(`[cron:wisdom] #${wisdomCountToday} today: "${response.slice(0, 60)}..."`)
}

// ── Start all crons ─────────────────────────────────────────────────

export function startCrons(client: Client) {
  log(`[cron] starting. lurk channels: ${config.lurkChannels.length}`)
  log(`[cron] gemini: ${geminiStatus()}`)

  // Floor check every 15 min
  setInterval(() => checkFloor(client), 15 * 60_000)

  // Whale check every 10 min
  setInterval(() => checkWhales(client), 10 * 60_000)

  // Daily alpha every minute (checks if 2pm UTC)
  setInterval(() => dailyAlpha(client), 60_000)

  // Random wisdom every 30 min
  setInterval(() => randomWisdom(client), 30 * 60_000)

  // Lurk scan every 5 min
  setInterval(() => scanChannels(client), 5 * 60_000)

  // Initial data fetch
  getCollectionStats().then(() => log('[cron] initial stats loaded'))
}
