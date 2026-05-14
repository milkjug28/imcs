import {
  Client,
  GatewayIntentBits,
  type Message,
} from 'discord.js'
import { config } from './config'
import { handleMention } from './handlers/mention'
import { startCrons } from './crons'
import { log, logError } from './utils/log'

export function createBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  })

  client.once('ready', () => {
    log(`savant agent online as ${client.user?.tag}`)
    log(`guild: ${config.guildId}`)
    log(`lurk channels: ${config.lurkChannels.join(', ') || '(none)'}`)

    startCrons(client)
  })

  const respondedTo = new Set<string>()
  const channelCooldowns = new Map<string, number>()
  const channelLocks = new Set<string>()
  const COOLDOWN_MS = 8_000

  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return
    if (message.webhookId) return
    if (!message.guild || message.guild.id !== config.guildId) return

    const mentioned = message.mentions.has(client.user!)
    if (!mentioned) return

    if (respondedTo.has(message.id)) return
    respondedTo.add(message.id)
    if (respondedTo.size > 200) {
      const first = respondedTo.values().next().value
      if (first) respondedTo.delete(first)
    }

    // Per-channel processing lock - only one response at a time per channel
    if (channelLocks.has(message.channelId)) {
      log(`[bot] channel locked, skip ${message.id} in ${message.channelId}`)
      return
    }

    const lastReply = channelCooldowns.get(message.channelId) || 0
    if (Date.now() - lastReply < COOLDOWN_MS) {
      log(`[bot] cooldown skip in ${message.channelId}`)
      return
    }

    channelLocks.add(message.channelId)
    channelCooldowns.set(message.channelId, Date.now())

    try {
      if ('sendTyping' in message.channel) await message.channel.sendTyping()
      await handleMention(message)
    } catch (err) {
      logError('[bot] mention handler error', err)
      try {
        await message.reply('brain broke lol. try agen')
      } catch { /* ignore */ }
    } finally {
      channelLocks.delete(message.channelId)
    }
  })

  client.on('error', (err) => logError('[bot] client error', err))

  return client
}

export async function startBot(): Promise<Client> {
  const client = createBot()
  await client.login(config.botToken)
  return client
}
