import dotenv from 'dotenv'
import path from 'path'

const root = path.resolve(__dirname, '..')
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
  type Interaction,
  type Message,
} from 'discord.js'
import { createClient } from '@supabase/supabase-js'

// ── Config ──────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!
const GUILD_ID = process.env.DISCORD_GUILD_ID!
const VERIFICATION_CHANNEL_ID = process.env.DISCORD_VERIFICATION_CHANNEL_ID
const SITE_URL = process.env.NEXT_PUBLIC_URL || 'https://imcs.world'
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const CRON_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

const ROLE_IDS = {
  verified: process.env.VERIFIED!,
  reel_sabant: process.env.REEL_SABANT!,
  supa_savants: process.env.SUPA_SAVANTS!,
  ched_savant: process.env.CHED_SAVANT!,
  absulut_ched_savanat: process.env.ABSULUT_CHED_SAVANAT!,
}

const TIERS = [
  { key: 'verified' as const, min: 1 },
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
    ])
    log('Slash commands registered')
  }

  // Post verification widget
  await postWidget()

  // Start cron
  log(`Cron set: re-verify every ${CRON_INTERVAL_MS / 3600000}h`)
  setInterval(runCron, CRON_INTERVAL_MS)
})

client.on('interactionCreate', async (interaction: Interaction) => {
  if (interaction.isButton() && interaction.customId === 'verify_savant') {
    await interaction.reply({
      content: `go here to verify ur holdins: ${SITE_URL}/sitee/verify`,
      ephemeral: true,
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
      ephemeral: true,
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
})

// ── Widget ──────────────────────────────────────────────────────────

async function postWidget() {
  if (!VERIFICATION_CHANNEL_ID) return

  const channel = client.channels.cache.get(VERIFICATION_CHANNEL_ID)
  if (!channel || !channel.isTextBased()) {
    log(`Channel ${VERIFICATION_CHANNEL_ID} not found`)
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
    .setTitle('savant verificashun')
    .setDescription(
      '**verify ur savant NFT holdins 2 get roles:**\n\n' +
      '✅ **verified** - 1+ savants\n' +
      '🧠 **reel sabant** - 2-5 savants\n' +
      '🔮 **supa savants** - 6-24 savants\n' +
      '👑 **ched savant** - 25-50 savants\n' +
      '🐐 **absulut ched savanat** - 51+ savants\n\n' +
      'roles r cumulative. cliq button below 2 start.'
    )
    .setColor(0x764ba2)
    .setFooter({ text: 'imaginary magic crypto savants' })

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_savant')
      .setLabel('verify holdins')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🧙')
  )

  await textChannel.send({ embeds: [embed], components: [row] })
  log('Widget posted')
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
      const count = await getHoldings(record.wallet_address)
      const earnedKeys = getTierKeys(count)

      // Update roles
      let member
      try {
        member = await guild.members.fetch(record.discord_user_id)
      } catch {
        log(`Member ${record.discord_user_id} not in server, skipping`)
        continue
      }

      const allRoleIds = Object.values(ROLE_IDS)
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

      // Update DB
      if (count !== record.token_count) {
        await supabase
          .from('discord_verifications')
          .update({
            token_count: count,
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

      // Small delay to avoid rate limits
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
