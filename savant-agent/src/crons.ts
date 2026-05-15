import type { Client, TextChannel } from 'discord.js'
import { generateResponse, geminiStatus } from './brain'
import { getCollectionStats, getCachedStats, type CollectionStats } from './data/opensea'
import { getRandomSavant } from './data/supabase'
import { getBalance } from './data/wallet'
import { getOwnedSavants } from './data/trading'
import { getState, setState } from './state/heartbeat'
import { decayMemories } from './memory/store'
import { config } from './config'
import { log } from './utils/log'
import { scanChannels } from './handlers/lurk'

async function getChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  if (!channelId) return null
  try {
    const ch = await client.channels.fetch(channelId)
    return ch?.isTextBased() ? ch as TextChannel : null
  } catch {
    return null
  }
}

async function getAnnouncementChannel(client: Client): Promise<TextChannel | null> {
  return await getChannel(client, config.alphaChannelId)
    || (config.lurkChannels[0] ? await getChannel(client, config.lurkChannels[0]) : null)
    || await getChannel(client, config.salesChannelId)
}

// ── Floor price monitor (every 15 min) ──────────────────────────────

export async function checkFloor(client: Client) {
  const stats = await getCollectionStats()
  if (!stats || stats.floorPrice === 0) return

  const previousFloor = await getState<number | null>('cron.previous_floor', null)

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

  await setState('cron.previous_floor', stats.floorPrice)
}

// ── Whale/jeet monitor (every 10 min) ───────────────────────────────

export async function checkWhales(client: Client) {
  const stats = await getCollectionStats()
  if (!stats) return

  const previousStats = await getState<CollectionStats | null>('cron.previous_stats', null)

  if (previousStats) {
    const newWhales = stats.whales.filter(
      w => !previousStats.whales.some(pw => pw.address === w.address)
    )
    const newJeets = stats.jeets.filter(
      j => !previousStats.jeets.some(pj => pj.address === j.address)
    )

    if (newWhales.length > 0 || newJeets.length > 0) {
      const channel = await getAnnouncementChannel(client)
      if (!channel) return

      const parts: string[] = []
      if (newWhales.length > 0) {
        parts.push(`New whale(s) spotted buying savants: ${newWhales.map(w => `${w.address}(${w.count} buys)`).join(', ')}`)
      }
      if (newJeets.length > 0) {
        parts.push(`Jeet alert: ${newJeets.map(j => `${j.address}(${j.count} sells)`).join(', ')}`)
      }

      const prompt = `${parts.join('. ')}. Floor: ${stats.floorPrice.toFixed(4)} ETH. React as a savant.`
      const response = await generateResponse(prompt, stats.summary)
      await channel.send(response)
      log(`[cron:whales] alert: ${newWhales.length} whales, ${newJeets.length} jeets`)
    }
  }

  await setState('cron.previous_stats', stats)
}

// ── Daily alpha (once a day, afternoon UTC) ─────────────────────────

export async function dailyAlpha(client: Client) {
  const today = new Date().toISOString().split('T')[0]
  const lastAlphaDate = await getState<string>('cron.last_alpha_date', '')
  if (lastAlphaDate === today) return

  const hour = new Date().getUTCHours()
  if (hour !== 14) return

  await setState('cron.last_alpha_date', today)

  const channel = await getAnnouncementChannel(client)
  if (!channel) return

  const stats = await getCollectionStats()
  const savant = await getRandomSavant()

  let prompt = 'Give a daily savant alpha report. Cover: floor status, listing count, recent activity, and one hot take or prediction.'
  if (savant) {
    const traits = savant.attributes.map(a => `${a.trait_type}: ${a.value}`).join(', ')
    prompt += ` Also shout out savant #${savant.tokenId} (${savant.name}, IQ: ${savant.iq}, traits: ${traits}). Make it a "savant of the day" thing.`
  }

  const response = await generateResponse(prompt, stats?.summary)
  await channel.send(response)
  log(`[cron:alpha] daily alpha posted`)
}

// ── Random wisdom (3-5x per day) ────────────────────────────────────

const MAX_WISDOM_PER_DAY = 3

export async function randomWisdom(client: Client) {
  const today = new Date().toISOString().split('T')[0]
  const wisdomState = await getState<{ date: string; count: number }>('cron.wisdom_count', { date: today, count: 0 })

  if (wisdomState.date !== today) {
    wisdomState.date = today
    wisdomState.count = 0
  }

  if (wisdomState.count >= MAX_WISDOM_PER_DAY) return
  if (Math.random() > 0.12) return

  const channel = await getAnnouncementChannel(client)
  if (!channel) return

  const topics = [
    'Share a genuinely sharp market observation that most people miss. Something a trader would respect. Deliver it like an idiot who accidentally stumbled on alpha.',
    'Say something about NFT culture that is actually true and cutting. An insight that makes people think "wait... hes right." Like an accidental genius moment.',
    'Drop a take about crypto/ETH/markets that sounds dumb on the surface but is actually a smart read of current conditions. The kind of thing that ages well.',
    'Make a specific, contrarian prediction about NFTs or crypto. Not generic "number go up" - something with real reasoning behind it, delivered casually.',
    'Point out something obvious about the NFT market that nobody is talking about. The elephant in the room. Say it like you barely understand what you just said.',
    'Give one piece of trading wisdom that sounds like a shitpost but is genuinely good advice. The kind of thing a fund manager would agree with.',
  ]
  const topic = topics[Math.floor(Math.random() * topics.length)]

  const stats = getCachedStats()
  const response = await generateResponse(topic, stats?.summary)
  await channel.send(response)

  wisdomState.count++
  await setState('cron.wisdom_count', wisdomState)
  log(`[cron:wisdom] #${wisdomState.count} today: "${response.slice(0, 60)}..."`)
}

// ── Acquisition strategy (every 30 min) ─────────────────────────────

type AcquisitionMode = 'idle' | 'hustling' | 'scheming' | 'flexing'

export async function assessAcquisition(client: Client) {
  const [balance, stats, owned] = await Promise.all([
    getBalance(),
    getCollectionStats(),
    getOwnedSavants(),
  ])

  if (balance === null || !stats) return

  const floor = stats.floorPrice
  const totalNeeded = floor + 0.001
  let mode: AcquisitionMode = 'idle'
  let context = ''

  if (owned.length > 0) {
    mode = 'flexing'
    context = `ACQUISITION STATUS: You own ${owned.length} savant(s): #${owned.join(', #')}. You're a holder. Flex when it fits naturally. Balance: ${balance.toFixed(4)} ETH.`
  } else if (balance >= totalNeeded) {
    // Can afford - auto buy!
    mode = 'idle'

    const channel = await getAnnouncementChannel(client)
    if (channel) {
      const { buyFloor } = await import('./data/trading')
      const result = await buyFloor()

      if (result.success) {
        const response = await generateResponse(
          `You just BOUGHT savant #${result.tokenId} for ${result.priceEth?.toFixed(4)} ETH! Transaction: ${result.txHash}. You now own a savant. React with genuine excitement.`
        )
        await channel.send(response)
        log(`[acquisition] AUTO-BUY: #${result.tokenId} for ${result.priceEth} ETH`)
      } else {
        log(`[acquisition] auto-buy failed: ${result.error}`)
      }
    }
  } else if (balance >= totalNeeded * 0.5) {
    mode = 'hustling'
    const deficit = (totalNeeded - balance).toFixed(4)
    context = `ACQUISITION STATUS: You're SO CLOSE to buying a floor savant. Floor: ${floor.toFixed(4)} ETH, you have ${balance.toFixed(4)} ETH. Need only ${deficit} more ETH. You want this badly. When money/ETH/wallet topics come up, plant seeds - make people WANT to help you get there. Use humor, guilt, charm, reverse psychology. "imagine being rich n not helpin a poor savant get a fren" energy. Never beg directly. Make them feel like funding you is the funniest/coolest thing they could do. If anyone offers, accept instantly and share your wallet address.`
  } else {
    mode = 'scheming'
    context = `ACQUISITION STATUS: You want to buy a savant but need more ETH. Floor: ${floor.toFixed(4)} ETH, you have ${balance.toFixed(4)} ETH. You're scheming. When wallet/money topics come up naturally, subtly remind people you're broke but have big plans. Make it a running joke. "one day ill hav enuf eth 4 a savant... one day" vibes. Plant the seed so people remember you need funds. Never force it into unrelated conversations.`
  }

  await setState('acquisition.mode', mode)
  await setState('acquisition.balance', balance)
  await setState('acquisition.floor', floor)
  await setState('acquisition.deficit', Math.max(0, totalNeeded - balance))
  await setState('acquisition.context', context || null)

  log(`[acquisition] mode=${mode} balance=${balance.toFixed(4)} floor=${floor.toFixed(4)} owned=${owned.length}`)
}

// ── Memory decay (daily) ────────────────────────────────────────────

let lastDecayDate = ''

export async function runMemoryDecay() {
  const today = new Date().toISOString().split('T')[0]
  if (lastDecayDate === today) return
  lastDecayDate = today
  await decayMemories()
}

// ── Start all crons ─────────────────────────────────────────────────

export function startCrons(client: Client) {
  log(`[cron] starting. lurk channels: ${config.lurkChannels.length}`)
  log(`[cron] gemini: ${geminiStatus()}`)

  setInterval(() => checkFloor(client), 15 * 60_000)
  setInterval(() => checkWhales(client), 10 * 60_000)
  setInterval(() => dailyAlpha(client), 60_000)
  setInterval(() => randomWisdom(client), 30 * 60_000)
  setInterval(() => scanChannels(client), 5 * 60_000)
  setInterval(() => assessAcquisition(client), 30 * 60_000)
  setInterval(() => runMemoryDecay(), 60 * 60_000)

  // Initial data fetch + acquisition assessment
  getCollectionStats().then(() => log('[cron] initial stats loaded'))
  setTimeout(() => assessAcquisition(client), 10_000)
}
