import dotenv from 'dotenv'
import path from 'path'

const root = process.cwd()
dotenv.config({ path: path.join(root, '.env') })
dotenv.config({ path: path.join(root, '.env.local'), override: true })
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  MessageFlags,
  type Interaction,
  type Message,
} from 'discord.js'
import { createClient } from '@supabase/supabase-js'
import { OpenSeaStreamClient } from '@opensea/stream-js'
import { WebSocket } from 'ws'

// ── Config ──────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!
const GUILD_ID = process.env.DISCORD_GUILD_ID!
const VERIFICATION_CHANNEL_ID = process.env.DISCORD_VERIFICATION_CHANNEL_ID
const SITE_URL = process.env.NEXT_PUBLIC_URL || 'https://imcs.world'
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const CRON_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
const SALES_CHANNEL_ID = '1503601324670062712'
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY
const COLLECTION_SLUG = 'imaginary-magic-crypto-savants'

const ROLE_IDS = {
  simpul_sabant: process.env.SIMPUL_SABANT!,
  reel_sabant: process.env.REEL_SABANT!,
  supa_savants: process.env.SUPA_SAVANTS!,
  ched_savant: process.env.CHED_SAVANT!,
  absulut_ched_savanat: process.env.ABSULUT_CHED_SAVANAT!,
}

const TIERS = [
  { key: 'simpul_sabant' as const, min: 1 },
  { key: 'reel_sabant' as const, min: 2 },
  { key: 'supa_savants' as const, min: 6 },
  { key: 'ched_savant' as const, min: 25 },
  { key: 'absulut_ched_savanat' as const, min: 51 },
]

// ── Supabase ────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// ── Helpers ─────────────────────────────────────────────────────────

function getTierKeys(count: number): string[] {
  return TIERS.filter(t => count >= t.min).map(t => t.key)
}

async function getHoldings(wallet: string): Promise<number> {
  const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=${SAVANT_TOKEN}&withMetadata=false&pageSize=1`
  const res = await fetch(url)
  if (!res.ok) return 0
  const data = await res.json()
  return data.totalCount ?? (data.ownedNfts?.length ?? 0)
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

// ── Bot ─────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
})

client.once('ready', async () => {
  log(`Bot online as ${client.user?.tag}`)

  // Register slash command
  const guild = client.guilds.cache.get(GUILD_ID)
  if (guild) {
    await guild.commands.set([
      new SlashCommandBuilder()
        .setName('verify')
        .setDescription('verify ur savant holdins n get roles')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('sabant')
        .setDescription('look up a savant by token id')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('token id (1-4269)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(4269)
        )
        .toJSON(),
    ])
    log('Slash commands registered')
  }

  // Post verification widget
  await postWidget()

  // Start crons
  log(`Cron set: re-verify every ${CRON_INTERVAL_MS / 3600000}h`)
  setInterval(runCron, CRON_INTERVAL_MS)

  if (OPENSEA_API_KEY) {
    startSalesStream()
  } else {
    log('OPENSEA_API_KEY not set - sales feed disabled')
  }
})

client.on('interactionCreate', async (interaction: Interaction) => {
  if (interaction.isButton() && interaction.customId === 'verify_savant') {
    await interaction.reply({
      content: `go here to verify ur holdins: ${SITE_URL}/sitee/verify`,
      flags: MessageFlags.Ephemeral,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('verify holdins')
            .setStyle(ButtonStyle.Link)
            .setURL(`${SITE_URL}/sitee/verify`)
        ),
      ],
    })
  }

  if (interaction.isCommand() && interaction.commandName === 'verify') {
    await interaction.reply({
      content: `connekt wallet + discord on our site to get ur roles`,
      flags: MessageFlags.Ephemeral,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('verify holdins')
            .setStyle(ButtonStyle.Link)
            .setURL(`${SITE_URL}/sitee/verify`)
        ),
      ],
    })
  }

  if (interaction.isCommand() && interaction.commandName === 'sabant') {
    await handleSavantLookup(interaction)
  }
})

// ── Savant Lookup ───────────────────────────────────────────────────

async function handleSavantLookup(interaction: import('discord.js').CommandInteraction) {
  try {
    await interaction.deferReply()
  } catch {
    return
  }

  const tokenId = interaction.options.get('id')?.value as number
  if (!tokenId || tokenId < 1 || tokenId > 4269) {
    await interaction.editReply('invalid id. pick 1-4269 u nerd')
    return
  }

  try {
    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${SAVANT_TOKEN}&tokenId=${tokenId}&refreshCache=false`
    const res = await fetch(url)
    if (!res.ok) throw new Error('alchemy error')

    const data = await res.json()
    const name = data.raw?.metadata?.name || `Savant #${tokenId}`
    const rawImage = data.raw?.metadata?.image || ''
    const imageUrl = rawImage.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${rawImage.slice(7)}`
      : data.image?.originalUrl || data.image?.cachedUrl || rawImage

    const embed = new EmbedBuilder()
      .setTitle(name)
      .setColor(0xff69b4)
      .setFooter({ text: `savant #${tokenId} • imaginary magic crypto savants` })

    if (imageUrl) {
      embed.setImage(imageUrl)
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    log(`Savant lookup error for #${tokenId}: ${err}`)
    await interaction.editReply('couldnt find dat savant. try agen')
  }
}

// ── Widget ──────────────────────────────────────────────────────────

async function postWidget() {
  if (!VERIFICATION_CHANNEL_ID) return

  let channel = client.channels.cache.get(VERIFICATION_CHANNEL_ID)
  if (!channel) {
    try {
      channel = await client.channels.fetch(VERIFICATION_CHANNEL_ID) ?? undefined
    } catch {
      log(`Channel ${VERIFICATION_CHANNEL_ID} not found`)
      return
    }
  }
  if (!channel || !channel.isTextBased()) {
    log(`Channel ${VERIFICATION_CHANNEL_ID} not text-based`)
    return
  }

  // Check if widget already posted
  const textChannel = channel as import('discord.js').TextChannel
  const messages = await textChannel.messages.fetch({ limit: 10 })
  const existing = messages.find((msg: Message) =>
    msg.author.id === client.user?.id &&
    msg.components.length > 0
  )
  if (existing) {
    log('Widget already exists, skipping')
    return
  }

  const embed = new EmbedBuilder()
    .setTitle('savant holder verificashun')
    .setDescription(
      '🤓 **simpul sabant** — 1 savant\n' +
      '🧠 **reel sabant** — 2-5 savants\n' +
      '🔮 **supa savants** — 6-24 savants\n' +
      '👑 **ched savant** — 25-50 savants\n' +
      '🐐 **absulut ched savanat** — 51+ savants\n\n' +
      'roles stack. cliq below 2 verify.'
    )
    .setColor(0xff69b4)
    .setFooter({ text: 'imaginary magic crypto savants' })

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_savant')
      .setLabel('prov ur a savant')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🧙')
  )

  await textChannel.send({
    content: '# verify ur savant holdins\n\nconnekt ur wallet 2 get instant holder roles.',
    embeds: [embed],
    components: [row],
  })
  log('Widget posted')
}

// ── Sales Stream (WebSocket) ────────────────────────────────────────

function startSalesStream() {
  const osClient = new OpenSeaStreamClient({
    token: OPENSEA_API_KEY!,
    connectOptions: { transport: WebSocket },
    onError: (err) => log(`Stream error: ${err}`),
  })

  osClient.onItemSold(COLLECTION_SLUG, async (event) => {
    try {
      const payload = event.payload
      const tokenId = payload.item?.nft_id?.split('/')?.pop() || '?'
      const name = payload.item?.metadata?.name || `Savant #${tokenId}`
      const image = payload.item?.metadata?.image_url || ''
      const priceWei = payload.sale_price || '0'
      const priceEth = (Number(priceWei) / 1e18).toFixed(4)
      const symbol = payload.payment_token?.symbol || 'ETH'
      const buyer = payload.taker?.address
        ? `${payload.taker.address.slice(0, 6)}...${payload.taker.address.slice(-4)}`
        : '???'
      const seller = payload.maker?.address
        ? `${payload.maker.address.slice(0, 6)}...${payload.maker.address.slice(-4)}`
        : '???'
      const permalink = payload.item?.permalink || `https://opensea.io/assets/ethereum/${SAVANT_TOKEN}/${tokenId}`

      const embed = new EmbedBuilder()
        .setTitle(`${name} sold!`)
        .setURL(permalink)
        .setColor(0x00ff88)
        .addFields(
          { name: 'price', value: `${priceEth} ${symbol}`, inline: true },
          { name: 'buyer', value: buyer, inline: true },
          { name: 'seller', value: seller, inline: true },
        )
        .setFooter({ text: 'imaginary magic crypto savants' })
        .setTimestamp(new Date(payload.event_timestamp))

      if (image) embed.setThumbnail(image)

      let salesChannel = client.channels.cache.get(SALES_CHANNEL_ID)
      if (!salesChannel) {
        salesChannel = await client.channels.fetch(SALES_CHANNEL_ID) ?? undefined
      }
      if (!salesChannel?.isTextBased()) return

      const textChannel = salesChannel as import('discord.js').TextChannel
      await textChannel.send({ embeds: [embed] })
      log(`Sale posted: ${name} for ${priceEth} ${symbol}`)
    } catch (err) {
      log(`Stream sale handler error: ${err}`)
    }
  })

  log('Sales stream connected (websocket)')
}

// ── Cron: re-verify all holders ─────────────────────────────────────

async function runCron() {
  log('Cron start: re-verifying all holders')

  const { data: records, error } = await supabase
    .from('discord_verifications')
    .select('*')

  if (error || !records) {
    log(`Cron error fetching records: ${error?.message}`)
    return
  }

  log(`Checking ${records.length} verified users`)

  const guild = client.guilds.cache.get(GUILD_ID)
  if (!guild) {
    log('Guild not found')
    return
  }

  let updated = 0
  let removed = 0

  for (const record of records) {
    try {
      // Fetch all wallets for this discord user
      const { data: wallets } = await supabase
        .from('discord_wallets')
        .select('wallet_address')
        .eq('discord_user_id', record.discord_user_id)

      let totalCount = 0

      if (wallets && wallets.length > 0) {
        for (const w of wallets) {
          const count = await getHoldings(w.wallet_address)
          await supabase
            .from('discord_wallets')
            .update({ token_count: count })
            .eq('wallet_address', w.wallet_address)
          totalCount += count
        }
      } else {
        totalCount = await getHoldings(record.wallet_address)
      }

      const earnedKeys = getTierKeys(totalCount)

      let member
      try {
        member = await guild.members.fetch(record.discord_user_id)
      } catch {
        log(`Member ${record.discord_user_id} not in server, skipping`)
        continue
      }

      for (const tier of TIERS) {
        const roleId = ROLE_IDS[tier.key]
        if (!roleId) continue

        if (earnedKeys.includes(tier.key)) {
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId)
          }
        } else {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId)
            removed++
          }
        }
      }

      if (totalCount !== record.token_count) {
        await supabase
          .from('discord_verifications')
          .update({
            token_count: totalCount,
            tiers: earnedKeys.length > 0 ? earnedKeys : null,
            last_checked: new Date().toISOString(),
          })
          .eq('discord_user_id', record.discord_user_id)
        updated++
      } else {
        await supabase
          .from('discord_verifications')
          .update({ last_checked: new Date().toISOString() })
          .eq('discord_user_id', record.discord_user_id)
      }

      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      log(`Error checking ${record.discord_user_id}: ${err}`)
    }
  }

  log(`Cron done. ${updated} updated, ${removed} roles removed`)
}

// ── Start ───────────────────────────────────────────────────────────

if (!BOT_TOKEN) {
  console.error('DISCORD_BOT_TOKEN not set')
  process.exit(1)
}

client.login(BOT_TOKEN)
