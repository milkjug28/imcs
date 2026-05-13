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

  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return
    if (!message.guild || message.guild.id !== config.guildId) return

    const mentioned = message.mentions.has(client.user!)
    if (!mentioned) return

    try {
      if ('sendTyping' in message.channel) await message.channel.sendTyping()
      await handleMention(message)
    } catch (err) {
      logError('[bot] mention handler error', err)
      try {
        await message.reply('brain broke lol. try agen')
      } catch { /* ignore */ }
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
