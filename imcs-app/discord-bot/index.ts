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
const ALPHA_CHANNEL_ID = process.env.ALPHA_CHANNEL_ID
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

// ── Alert Cache ────────────────────────────────────────────────────

interface ListingAlert {
  discord_user_id: string
  alert_type: 'price' | 'trait' | 'token'
  max_price: number | null
  trait_type: string | null
  trait_value: string | null
  token_id: number | null
}

const alertCache = new Map<string, ListingAlert>()
let traitValuesCache: Map<string, Set<string>> | null = null

async function loadAlerts() {
  const { data } = await supabase.from('listing_alerts').select('*')
  if (!data) return
  alertCache.clear()
  for (const row of data) {
    alertCache.set(row.discord_user_id, row as ListingAlert)
  }
  log(`Loaded ${alertCache.size} listing alerts`)
}

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
      new SlashCommandBuilder()
        .setName('alert')
        .setDescription('get notified wen a savant u want gets listed')
        .addSubcommand(sub => sub
          .setName('price')
          .setDescription('alert wen any savant listed under a price')
          .addNumberOption(opt => opt.setName('max_eth').setDescription('max price in ETH').setRequired(true))
        )
        .addSubcommand(sub => sub
          .setName('trait')
          .setDescription('alert wen savant wit specific trait gets listed')
          .addStringOption(opt => opt.setName('trait_type').setDescription('trait category').setRequired(true)
            .addChoices(
              { name: "bg's", value: "bg's" },
              { name: 'bods', value: 'bods' },
              { name: 'cloths', value: 'cloths' },
              { name: 'ayezz', value: 'ayezz' },
              { name: 'moufs', value: 'moufs' },
              { name: 'hatss', value: 'hatss' },
              { name: 'extruhs', value: 'extruhs' },
              { name: 'facessories', value: 'facessories' },
              { name: 'speshul', value: 'speshul' },
            ))
          .addStringOption(opt => opt.setName('value').setDescription('trait value').setRequired(true).setAutocomplete(true))
          .addNumberOption(opt => opt.setName('max_eth').setDescription('max price in ETH (optional)'))
        )
        .addSubcommand(sub => sub
          .setName('token')
          .setDescription('alert wen a specific savant gets listed')
          .addIntegerOption(opt => opt.setName('id').setDescription('token id (1-4269)').setRequired(true).setMinValue(1).setMaxValue(4269))
        )
        .addSubcommand(sub => sub
          .setName('clear')
          .setDescription('remove ur alert')
        )
        .addSubcommand(sub => sub
          .setName('status')
          .setDescription('check ur current alert')
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

  await loadAlerts()

  if (OPENSEA_API_KEY) {
    startSalesStream()
    startListingStream()
  } else {
    log('OPENSEA_API_KEY not set - sales/listing feed disabled')
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

  if (interaction.isChatInputCommand() && interaction.commandName === 'alert') {
    await handleAlert(interaction)
  }

  if (interaction.isAutocomplete() && interaction.commandName === 'alert') {
    await handleAlertAutocomplete(interaction)
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
    const [metaRes, rarityRes] = await Promise.all([
      fetch(`${SITE_URL}/api/metadata/${tokenId}`),
      fetch(`${SITE_URL}/api/rarity?tokenId=${tokenId}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    if (!metaRes.ok) throw new Error(`metadata api ${metaRes.status}`)

    const data = await metaRes.json()
    const name = data.savant_name ? `${data.savant_name} (${data.name})` : data.name || `Savant #${tokenId}`
    const imageUrl = data.image || ''

    const iq = data.attributes?.find((a: { trait_type: string }) => a.trait_type === 'IQ')?.value || '?'
    const rank = rarityRes?.rank ? `#${rarityRes.rank} / 4269` : '?'
    const isOneOfOne = rarityRes?.isOneOfOne

    const description = isOneOfOne
      ? `IQ: ${iq} • rarity: ${rank} • **1/1** ✨`
      : `IQ: ${iq} • rarity: ${rank}`

    const embed = new EmbedBuilder()
      .setTitle(name)
      .setColor(isOneOfOne ? 0xffd700 : 0xff69b4)
      .setDescription(description)
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

// ── Alert Handlers ─────────────────────────────────────────────────

async function handleAlert(interaction: import('discord.js').ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand()
  const userId = interaction.user.id

  if (sub === 'clear') {
    await supabase.from('listing_alerts').delete().eq('discord_user_id', userId)
    alertCache.delete(userId)
    await interaction.reply({ content: 'alert removed. u wont get notified no more', flags: MessageFlags.Ephemeral })
    return
  }

  if (sub === 'status') {
    const alert = alertCache.get(userId)
    if (!alert) {
      await interaction.reply({ content: 'u dont hav an alert set. use /alert price, /alert trait, or /alert token', flags: MessageFlags.Ephemeral })
      return
    }
    let desc = ''
    if (alert.alert_type === 'price') desc = `any savant listed under ${alert.max_price} ETH`
    else if (alert.alert_type === 'trait') desc = `${alert.trait_type}: ${alert.trait_value}${alert.max_price ? ` under ${alert.max_price} ETH` : ''}`
    else if (alert.alert_type === 'token') desc = `savant #${alert.token_id}`
    await interaction.reply({ content: `ur alert: ${desc}`, flags: MessageFlags.Ephemeral })
    return
  }

  if (sub === 'price') {
    const maxEth = interaction.options.getNumber('max_eth', true)
    const alert: ListingAlert = { discord_user_id: userId, alert_type: 'price', max_price: maxEth, trait_type: null, trait_value: null, token_id: null }
    await supabase.from('listing_alerts').upsert({ ...alert, created_at: new Date().toISOString() }, { onConflict: 'discord_user_id' })
    alertCache.set(userId, alert)
    await interaction.reply({ content: `alert set: ill tag u wen any savant lists under ${maxEth} ETH`, flags: MessageFlags.Ephemeral })
    return
  }

  if (sub === 'trait') {
    const traitType = interaction.options.getString('trait_type', true)
    const traitValue = interaction.options.getString('value', true)
    const maxEth = interaction.options.getNumber('max_eth') || null
    const alert: ListingAlert = { discord_user_id: userId, alert_type: 'trait', max_price: maxEth, trait_type: traitType, trait_value: traitValue, token_id: null }
    await supabase.from('listing_alerts').upsert({ ...alert, created_at: new Date().toISOString() }, { onConflict: 'discord_user_id' })
    alertCache.set(userId, alert)
    const priceNote = maxEth ? ` under ${maxEth} ETH` : ''
    await interaction.reply({ content: `alert set: ill tag u wen a savant wit ${traitType}: ${traitValue}${priceNote} gets listed`, flags: MessageFlags.Ephemeral })
    return
  }

  if (sub === 'token') {
    const tokenId = interaction.options.getInteger('id', true)
    const alert: ListingAlert = { discord_user_id: userId, alert_type: 'token', max_price: null, trait_type: null, trait_value: null, token_id: tokenId }
    await supabase.from('listing_alerts').upsert({ ...alert, created_at: new Date().toISOString() }, { onConflict: 'discord_user_id' })
    alertCache.set(userId, alert)
    await interaction.reply({ content: `alert set: ill tag u wen savant #${tokenId} gets listed`, flags: MessageFlags.Ephemeral })
    return
  }
}

async function handleAlertAutocomplete(interaction: import('discord.js').AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true)
  if (focused.name !== 'value') return

  const traitType = interaction.options.getString('trait_type')
  if (!traitType) {
    await interaction.respond([])
    return
  }

  if (!traitValuesCache) {
    const allTraits = new Map<string, Set<string>>()
    let page = 0
    const pageSize = 1000
    while (true) {
      const { data } = await supabase.from('savant_metadata').select('attributes').range(page * pageSize, (page + 1) * pageSize - 1)
      if (!data || data.length === 0) break
      for (const row of data) {
        const attrs = row.attributes as { trait_type: string; value: string }[] || []
        for (const a of attrs) {
          if (!a.value) continue
          if (!allTraits.has(a.trait_type)) allTraits.set(a.trait_type, new Set())
          allTraits.get(a.trait_type)!.add(a.value)
        }
      }
      if (data.length < pageSize) break
      page++
    }
    traitValuesCache = allTraits
    log(`Cached trait values: ${[...allTraits.entries()].map(([k, v]) => `${k}(${v.size})`).join(', ')}`)
  }

  const values = traitValuesCache.get(traitType) || new Set<string>()

  const query = focused.value.toLowerCase()
  const filtered = [...values]
    .filter(v => v.toLowerCase().includes(query))
    .sort()
    .slice(0, 25)

  await interaction.respond(filtered.map(v => ({ name: v, value: v })))
}

// ── Listing Stream (WebSocket) ─────────────────────────────────────

function startListingStream() {
  if (!ALPHA_CHANNEL_ID) {
    log('ALPHA_CHANNEL_ID not set - listing alerts disabled')
    return
  }

  const osClient = new OpenSeaStreamClient({
    token: OPENSEA_API_KEY!,
    connectOptions: { transport: WebSocket },
    onError: (err) => log(`Listing stream error: ${err}`),
  })

  osClient.onItemListed(COLLECTION_SLUG, async (event) => {
    if (alertCache.size === 0) return

    try {
      const payload = event.payload
      const tokenId = payload.item?.nft_id?.split('/')?.pop() || '?'
      const tokenNum = parseInt(tokenId)
      const priceWei = payload.base_price || '0'
      const priceEth = Number(priceWei) / 1e18
      const permalink = payload.item?.permalink || `https://opensea.io/assets/ethereum/${SAVANT_TOKEN}/${tokenId}`
      const seller = payload.maker?.address
        ? `${payload.maker.address.slice(0, 6)}...${payload.maker.address.slice(-4)}`
        : '???'

      let metadata: { name?: string; image?: string; savant_name?: string; attributes?: { trait_type: string; value: string }[] } | null = null

      const matchedUsers: string[] = []

      for (const [userId, alert] of alertCache) {
        if (alert.alert_type === 'token') {
          if (tokenNum === alert.token_id) matchedUsers.push(userId)
          continue
        }

        if (alert.alert_type === 'price') {
          if (alert.max_price && priceEth <= alert.max_price) matchedUsers.push(userId)
          continue
        }

        if (alert.alert_type === 'trait') {
          if (!metadata && !isNaN(tokenNum)) {
            const res = await fetch(`${SITE_URL}/api/metadata/${tokenNum}`)
            metadata = res.ok ? await res.json() : null
          }
          if (!metadata?.attributes) continue

          const hasMatch = metadata.attributes.some(
            a => a.trait_type === alert.trait_type && a.value === alert.trait_value
          )
          if (!hasMatch) continue
          if (alert.max_price && priceEth > alert.max_price) continue
          matchedUsers.push(userId)
        }
      }

      if (matchedUsers.length === 0) return

      if (!metadata && !isNaN(tokenNum)) {
        const res = await fetch(`${SITE_URL}/api/metadata/${tokenNum}`)
        metadata = res.ok ? await res.json() : null
      }

      const name = metadata?.savant_name
        ? `${metadata.savant_name} (${metadata.name})`
        : metadata?.name || `Savant #${tokenId}`
      const image = metadata?.image || ''

      const embed = new EmbedBuilder()
        .setTitle(`${name} just listed!`)
        .setURL(permalink)
        .setColor(0x00aaff)
        .addFields(
          { name: 'price', value: `${priceEth.toFixed(4)} ETH`, inline: true },
          { name: 'seller', value: seller, inline: true },
        )
        .setFooter({ text: '/alert clear to stop alerts' })
        .setTimestamp(new Date(payload.event_timestamp))

      if (image) embed.setThumbnail(image)

      let alertChannel = client.channels.cache.get(ALPHA_CHANNEL_ID)
      if (!alertChannel) {
        alertChannel = await client.channels.fetch(ALPHA_CHANNEL_ID) ?? undefined
      }
      if (!alertChannel?.isTextBased()) return

      const tags = matchedUsers.map(id => `<@${id}>`).join(' ')
      const textChannel = alertChannel as import('discord.js').TextChannel
      await textChannel.send({ content: `${tags} a savannt u wunt jus gott listud!`, embeds: [embed] })
      log(`Listing alert: #${tokenId} at ${priceEth.toFixed(4)} ETH -> ${matchedUsers.length} user(s)`)
    } catch (err) {
      log(`Listing stream handler error: ${err}`)
    }
  })

  log('Listing stream connected (websocket)')
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
      const tokenNum = parseInt(tokenId)
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

      // Fetch token stats from supabase + OpenSea rarity
      let iq = '?'
      let rarityRank = '?'
      let savantName = ''
      if (!isNaN(tokenNum)) {
        const ONE_OF_ONE_TOKENS = new Set([315, 851, 1023, 1865, 2902, 3541, 4248])
        const baseIQ = ONE_OF_ONE_TOKENS.has(tokenNum) ? 111 : 69

        const [iqRes, osRes] = await Promise.all([
          supabase.from('savant_iq').select('iq_points, savant_name').eq('token_id', tokenNum).single(),
          fetch(`https://api.opensea.io/api/v2/chain/ethereum/contract/${SAVANT_TOKEN}/nfts/${tokenNum}`, {
            headers: { 'x-api-key': OPENSEA_API_KEY! },
          }).then(r => r.ok ? r.json() : null).catch(() => null),
        ])

        const allocated = iqRes.data?.iq_points ?? 0
        iq = String(baseIQ + allocated)
        savantName = iqRes.data?.savant_name || ''

        const rank = osRes?.nft?.rarity?.rank
        if (rank) rarityRank = `#${rank} / 4269`
      }

      const title = savantName ? `${savantName} (${name}) sold!` : `${name} sold!`

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setURL(permalink)
        .setColor(0x00ff88)
        .addFields(
          { name: 'price', value: `${priceEth} ${symbol}`, inline: true },
          { name: 'IQ', value: iq, inline: true },
          { name: 'rarity', value: rarityRank, inline: true },
          { name: 'buyer', value: buyer, inline: true },
          { name: 'seller', value: seller, inline: true },
        )
        .setFooter({ text: 'imaginary magic crypto savants' })
        .setTimestamp(new Date(payload.event_timestamp))

      if (image) embed.setImage(image)

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
