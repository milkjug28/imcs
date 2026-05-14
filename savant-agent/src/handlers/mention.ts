import type { Message, TextChannel } from 'discord.js'
import { generateResponse } from '../brain'
import { getCollectionStats } from '../opensea'
import { getMarketData, marketSummary } from '../market'
import { getSavantMetadata } from '../supabase'
import { getBalance, walletContext } from '../wallet'
import { log } from '../utils/log'

const recentResponses: string[] = []
const MAX_RECENT = 20

function trackResponse(text: string) {
  recentResponses.push(text)
  if (recentResponses.length > MAX_RECENT) recentResponses.shift()
}

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

  const stats = await getCollectionStats()

  // Check if asking about a specific savant
  const tokenMatch = content.match(/(?:savant|#)\s*(\d{1,4})/i)
  let savantContext = ''
  if (tokenMatch) {
    const tokenId = parseInt(tokenMatch[1])
    if (tokenId >= 1 && tokenId <= 4269) {
      const meta = await getSavantMetadata(tokenId)
      if (meta) {
        const traits = meta.attributes.map(a => `${a.trait_type}: ${a.value}`).join(', ')
        savantContext = `\nSAVANT #${tokenId} DATA: ${meta.name}. IQ: ${meta.iq}. ${meta.savantName ? `Named: ${meta.savantName}. ` : ''}Traits: ${traits}`
      }
    }
  }

  const antiRepeat = recentResponses.length > 0
    ? `\nDo NOT repeat or rephrase these recent responses: ${recentResponses.slice(-5).map(r => `"${r}"`).join(', ')}`
    : ''

  const prompt = `Chat log:\n${chatLog}\n\n${message.author.username} just said: "${content}"\n\nReply to what they said. Be specific to their words.${antiRepeat}`

  const walletTrigger = /your (wallet|address)|send (u|you)|donate|tip|fund you|help you buy|give you|wallet address|ur address/i
  const wantsWallet = walletTrigger.test(content)

  const marketKeywords = /price|btc|bitcoin|eth|ethereum|sol|solana|market|pump|dump|bull|bear|chart|trading|defi|token|gas|gwei/i
  const wantsMarket = marketKeywords.test(content)

  const [balance, market] = await Promise.all([
    wantsWallet ? getBalance() : Promise.resolve(null),
    wantsMarket ? getMarketData() : Promise.resolve(null),
  ])

  const walletCtx = wantsWallet ? walletContext(balance, stats?.floorPrice ?? 0) : ''
  const marketCtx = market ? marketSummary(market) : ''

  const extraContext = [
    stats?.summary,
    marketCtx,
    savantContext,
    walletCtx,
  ].filter(Boolean).join('\n')

  const response = await generateResponse(prompt, extraContext || undefined)
  trackResponse(response)

  await message.reply(response)
  log(`[mention] replied: "${response}"`)
}
