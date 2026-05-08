import { NextRequest, NextResponse } from 'next/server'
import { isAddress, getAddress } from 'viem'
import { supabase } from '@/lib/supabase'
import { pickRespondingBots, buildBotPrompt, BotPersona } from '@/lib/chat-bots'
import { geminiRotator } from '@/lib/gemini-rotator'

const RATE_LIMIT_WINDOW = 5000
const recentSenders = new Map<string, number>()

async function insertBotResponse(bot: BotPersona, recentMessages: { username: string; message: string }[]) {
  try {
    console.log(`[chat-bot] ${bot.name} generating response...`)
    const prompt = buildBotPrompt(bot, recentMessages)
    const { text, model } = await geminiRotator.call(prompt, bot.systemPrompt)
    console.log(`[chat-bot] ${bot.name} got response from ${model}: "${text.slice(0, 50)}"`)

    const cleaned = text.trim().replace(/^["']|["']$/g, '')
    if (!cleaned || cleaned.length > 200) {
      console.log(`[chat-bot] ${bot.name} response rejected (empty or >200 chars)`)
      return
    }

    const delay = 2000 + Math.random() * 6000
    console.log(`[chat-bot] ${bot.name} waiting ${Math.round(delay)}ms before inserting...`)
    await new Promise(r => setTimeout(r, delay))

    const { error } = await supabase.from('chat_messages').insert({
      wallet_address: bot.wallet,
      username: bot.name,
      message: cleaned,
      is_bot: true,
    })
    if (error) console.error(`[chat-bot] ${bot.name} DB insert failed:`, error)
    else console.log(`[chat-bot] ${bot.name} inserted: "${cleaned}"`)
  } catch (err) {
    console.error(`[chat-bot] ${bot.name} FAILED:`, err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { wallet, message, username } = await req.json()

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }

    const trimmed = message.trim()
    if (trimmed.length === 0 || trimmed.length > 500) {
      return NextResponse.json({ error: 'Message must be 1-500 characters' }, { status: 400 })
    }

    const checksummed = getAddress(wallet)
    const now = Date.now()
    const lastSent = recentSenders.get(checksummed) || 0
    if (now - lastSent < RATE_LIMIT_WINDOW) {
      return NextResponse.json({ error: 'Slow down' }, { status: 429 })
    }
    recentSenders.set(checksummed, now)

    const displayName = username?.trim().slice(0, 20) || `${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`

    const { error } = await supabase.from('chat_messages').insert({
      wallet_address: checksummed,
      username: displayName,
      message: trimmed,
      is_bot: false,
    })

    if (error) {
      console.error('Chat insert error:', error)
      return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
    }

    const { data: recent } = await supabase
      .from('chat_messages')
      .select('username, message')
      .order('created_at', { ascending: false })
      .limit(10)

    const recentMessages = (recent || []).reverse().map(m => ({
      username: m.username,
      message: m.message,
    }))

    const respondingBots = pickRespondingBots(trimmed)
    for (const bot of respondingBots) {
      insertBotResponse(bot, recentMessages)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
