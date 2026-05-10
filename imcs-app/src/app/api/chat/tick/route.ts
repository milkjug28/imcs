import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { BOT_PERSONAS, BotPersona } from '@/lib/chat-bots'
import { geminiRotator } from '@/lib/gemini-rotator'
import { getCollectionStats } from '@/lib/opensea-stats'

const IDLE_PROMPTS = [
  'Comment on recent sales or floor price if you have stats. Keep it casual.',
  'Call out jeets or hype whale activity if you see it in the data.',
  'Chat is dead. Say something unhinged or funny to wake people up. Be yourself.',
  'Start a random convo. Ask the chat something dumb or share a hot take about anything.',
  'Talk shit about paper hands or hype diamond hands. Use real stats if available.',
  'Say something random and funny. Not about trading. Just be weird.',
  'Drop some fake wisdom or start a random argument about literally anything.',
  'Scheme with the chat. What should savants do next? Drop an idea, even if its dumb.',
  'Complain about something random. Gas fees, the weather, your wifi, whatever.',
  'Flex on the chat. Talk about your bags, your IQ, or how early you got in.',
  'Ask the chat a dumb question. "would u rather have 100 savants or 1 bored ape" type energy.',
  'React to a recent message in the chat. Agree, disagree, or roast it.',
  'Talk about what you did today. Make it up. Be ridiculous.',
  'Drop a conspiracy theory about the savants collection. Make it absurd.',
  'Challenge someone in the chat to something stupid. A bet, a dare, whatever.',
  'Say something wholesome for once. Then immediately ruin it.',
]

async function generateIdleMessage(bot: BotPersona, recentMessages: { username: string; message: string }[]) {
  const context = recentMessages.length > 0
    ? recentMessages.slice(-5).map(m => `${m.username}: ${m.message}`).join('\n')
    : '(empty chat)'

  const idlePrompt = IDLE_PROMPTS[Math.floor(Math.random() * IDLE_PROMPTS.length)]

  const stats = await getCollectionStats().catch(() => null)
  const statsLine = stats?.summary ? `\n\nLIVE COLLECTION DATA: ${stats.summary}` : ''

  const ownRecent = recentMessages
    .filter(m => m.username === bot.name)
    .map(m => m.message)
    .join(', ')
  const antiRepeat = ownRecent ? `\n\nYou already said these recently, DO NOT repeat or rephrase them: "${ownRecent}"` : ''

  const prompt = `Recent chat:\n${context}\n\n${idlePrompt} Don't repeat anything already said.${statsLine}${antiRepeat}`

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
    .limit(15)

  const recentMessages = (recent || []).reverse().map(m => ({
    username: m.username,
    message: m.message,
  }))

  const bot = BOT_PERSONAS[Math.floor(Math.random() * BOT_PERSONAS.length)]
  await generateIdleMessage(bot, recentMessages)

  return NextResponse.json({ ok: true, bot: bot.name })
}
