import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

dotenv.config({ path: resolve(root, '.env') })

// Also load from imcs-app if savant-agent .env is sparse
const imcsRoot = resolve(root, '..', 'imcs-app')
dotenv.config({ path: resolve(imcsRoot, '.env') })
dotenv.config({ path: resolve(imcsRoot, '.env.local') })

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

export const config = {
  botToken: process.env.SAVANT_BOT_TOKEN || required('DISCORD_BOT_TOKEN'),
  guildId: required('DISCORD_GUILD_ID'),
  lurkChannels: (process.env.SAVANT_CHANNELS || '').split(',').filter(Boolean),
  salesChannelId: process.env.SALES_CHANNEL_ID || '',
  alphaChannelId: process.env.ALPHA_CHANNEL_ID || '',

  geminiKeys: [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean) as string[],

  openseaKey: process.env.OPENSEA_API_KEY || '',

  supabaseUrl: required('SUPABASE_URL'),
  supabaseKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  alchemyKey: process.env.ALCHEMY_API_KEY || '',

  openRouterKey: process.env.OPEN_ROUTER_API_KEY || '',

  savantWallet: process.env.SAVANT_PUBLIC_WALLET || '',
  savantPrivateKey: process.env.SAVANT_WALLET_PRIVATE_KEY || '',

  collectionSlug: 'imaginary-magic-crypto-savants',
  contractAddress: '0x95fa6fc553F5bE3160b191b0133236367A835C63',
  totalSupply: 4269,
} as const
