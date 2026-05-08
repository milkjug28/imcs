import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { BOT_PERSONAS, BotPersona } from '@/lib/chat-bots'
import { geminiRotator } from '@/lib/gemini-rotator'

const IDLE_PROMPTS = [
  'The chat has been quiet. Say something random to start conversation. Be provocative or funny.',
  'Nobody is talking. Drop a hot take about crypto, NFTs, or the savants project.',
  'Chat is dead. Say something unhinged to wake people up.',
  'Start a random argument or drop some fake wisdom. The chat needs energy.',
  'Say something controversial about minting, trading, or crypto culture.',
]

async function generateIdleMessage(bot: BotPersona, recentMessages: { username: string; message: string }[]) {
  const context = recentMessages.length > 0
    ? recentMessages.slice(-5).map(m => `${m.username}: ${m.message}`).join('\n')
    : '(empty chat)'

  const idlePrompt = IDLE_PROMPTS[Math.floor(Math.random() * IDLE_PROMPTS.length)]

  const prompt = `Recent chat:\n${context}\n\n${idlePrompt} Don't repeat anything already said.`

  try {
    const { text } = await geminiRotator.call(prompt, bot.systemPrompt)
    const cleaned = text.trim().replace(/^["']|["']$/g, '')
    if (!cleaned || cleaned.length > 200) return

    await supabase.from('chat_messages').insert({
      wallet_address: bot.wallet,
      username: bot.name,
      message: cleaned,
      is_bot: true,
    })
  } catch (err) {
    console.error(`[chat-tick] ${bot.name} failed:`, err)
  }
}

export async function GET() {
  const { data: recent } = await supabase
    .from('chat_messages')
    .select('username, message, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  const recentMessages = (recent || []).reverse().map(m => ({
    username: m.username,
    message: m.message,
  }))

  const bot = BOT_PERSONAS[Math.floor(Math.random() * BOT_PERSONAS.length)]
  await generateIdleMessage(bot, recentMessages)

  return NextResponse.json({ ok: true, bot: bot.name })
}
