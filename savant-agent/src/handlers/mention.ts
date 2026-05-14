import type { Message, TextChannel } from 'discord.js'
import { generateResponse } from '../brain'
import { getCollectionStats } from '../opensea'
import { getMarketData, marketSummary } from '../market'
import { getSavantMetadata } from '../supabase'
import { getBalance, walletContextBasic, walletContextFull } from '../wallet'
import { buyFloor, getFloorListings, getOwnedSavants } from '../trading'
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

  // Buy command - explicit request to buy a savant
  const buyTrigger = /\b(buy|cop|scoop|grab|get|snag)\b.*(savant|floor|one|nft)/i
  if (buyTrigger.test(content)) {
    await handleBuyRequest(message, content)
    return
  }

  // Collection check
  const collectionTrigger = /\b(what|how many|which).*(savant|nft).*(u |you |do you |u got|you got|you have|u have|own|hold)/i
  if (collectionTrigger.test(content)) {
    await handleCollectionCheck(message)
    return
  }

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

  // Always know you have a wallet. Only reveal address when there's an opportunity.
  const addressTrigger = /wall[ue]t|addr|addi|send.*(eth|u |you )|donate|tip|fund|help.*(buy|u |you )|give.*(eth|u |you )|contribute|sponsor/i
  const showAddress = addressTrigger.test(content)

  const marketKeywords = /price|btc|bitcoin|eth|ethereum|sol|solana|market|pump|dump|bull|bear|chart|trading|defi|token|gas|gwei/i
  const wantsMarket = marketKeywords.test(content)

  const [balance, market, basicWallet] = await Promise.all([
    showAddress ? getBalance() : Promise.resolve(null),
    wantsMarket ? getMarketData() : Promise.resolve(null),
    walletContextBasic(),
  ])

  const walletCtx = showAddress
    ? walletContextFull(balance, stats?.floorPrice ?? 0)
    : basicWallet
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

async function handleBuyRequest(message: Message, content: string) {
  const balance = await getBalance()

  if (balance === null || balance < 0.001) {
    const response = await generateResponse(
      `Someone told you to buy a savant but you don't have enough ETH. Your balance is ${balance?.toFixed(4) ?? '0'} ETH. React naturally - you want to buy but can't afford it yet. Don't beg, but you can be creative about it.`
    )
    trackResponse(response)
    await message.reply(response)
    return
  }

  const listings = await getFloorListings(3)
  if (listings.length === 0) {
    await message.reply('no listings rn. evry1 diamond handin apparently')
    return
  }

  const floor = listings[0]
  const totalNeeded = floor.priceEth + 0.002

  if (balance < totalNeeded) {
    const response = await generateResponse(
      `Someone told you to buy a savant. Floor is ${floor.priceEth.toFixed(4)} ETH but you only have ${balance.toFixed(4)} ETH. You need about ${(totalNeeded - balance).toFixed(4)} more for floor + gas. React naturally.`
    )
    trackResponse(response)
    await message.reply(response)
    return
  }

  // Can afford it - buy
  const thinkingResponse = await generateResponse(
    `Someone told you to buy a savant and you can actually afford one. Floor is ${floor.priceEth.toFixed(4)} ETH, you have ${balance.toFixed(4)} ETH. Savant #${floor.tokenId} is the cheapest. You're about to do it. Say something short and excited.`
  )
  await message.reply(thinkingResponse)

  const result = await buyFloor()

  if (result.success) {
    const response = await generateResponse(
      `You just BOUGHT savant #${result.tokenId} for ${result.priceEth?.toFixed(4)} ETH! Transaction: ${result.txHash}. You now own a savant. React with genuine excitement but stay in character.`
    )
    trackResponse(response)
    await message.reply(response)
    log(`[trading] SUCCESS: bought #${result.tokenId} for ${result.priceEth} ETH tx=${result.txHash}`)
  } else {
    const response = await generateResponse(
      `You tried to buy a savant but it failed: "${result.error}". React naturally, be annoyed but not devastated.`
    )
    trackResponse(response)
    await message.reply(response)
  }
}

async function handleCollectionCheck(message: Message) {
  const owned = await getOwnedSavants()
  let response: string

  if (owned.length === 0) {
    response = await generateResponse(
      `Someone asked how many savants you own. You don't own any yet. You're working on it. Be honest but confident about it.`
    )
  } else {
    response = await generateResponse(
      `Someone asked about your savant collection. You own ${owned.length} savant(s): #${owned.join(', #')}. Flex a little but keep it savant-style.`
    )
  }

  trackResponse(response)
  await message.reply(response)
}
