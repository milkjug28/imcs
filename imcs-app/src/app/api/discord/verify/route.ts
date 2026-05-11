import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isAddress, getAddress } from 'viem'
import { getDiscordUser, assignTierRoles, getTiersForCount } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const GUILD_ID = process.env.DISCORD_GUILD_ID!

async function getHoldings(wallet: string): Promise<number> {
  const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=${SAVANT_TOKEN}&withMetadata=false&pageSize=100`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('alchemy error')
  const data = await res.json()
  return data.totalCount ?? (data.ownedNfts?.length ?? 0)
}

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIP(request)
    const rl = rateLimit(`discord-verify:${ip}`, { limit: 5, windowMs: 300_000 })
    if (!rl.success) {
      return NextResponse.json({ error: 'slow down nerd' }, { status: 429 })
    }

    const body = await request.json()
    const { wallet } = body

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const accessToken = cookieStore.get('discord_access_token')?.value
    if (!accessToken) {
      return NextResponse.json({ error: 'discord not linked. connect discord first' }, { status: 401 })
    }

    const discordUser = await getDiscordUser(accessToken)
    const checksummed = getAddress(wallet)
    const tokenCount = await getHoldings(checksummed)

    if (tokenCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'u dont hold any savants, dummie',
        tokenCount: 0,
        tiers: [],
      })
    }

    const tiers = getTiersForCount(tokenCount)
    const tierNames = tiers.map(t => t.name)

    const { error: dbError } = await supabase
      .from('discord_verifications')
      .upsert({
        discord_user_id: discordUser.id,
        discord_username: discordUser.username,
        wallet_address: checksummed,
        token_count: tokenCount,
        tiers: tierNames,
        verified_at: new Date().toISOString(),
        last_checked: new Date().toISOString(),
      }, { onConflict: 'discord_user_id' })

    if (dbError) {
      console.error('Supabase upsert error:', dbError)
      return NextResponse.json({ error: 'database error' }, { status: 500 })
    }

    await assignTierRoles(GUILD_ID, discordUser.id, tokenCount)

    cookieStore.delete('discord_access_token')

    return NextResponse.json({
      success: true,
      message: tokenCount >= 51
        ? 'ABSULUT CHED SAVANAT!!! u ar da goat'
        : tokenCount >= 25
        ? 'CHED SAVANT DETECTED!!! u ar legend'
        : tokenCount >= 6
        ? 'supa savants status achieved. respekt'
        : tokenCount >= 2
        ? 'reel sabant energy. nice'
        : 'verified holder. welcum 2 savant wurld',
      tokenCount,
      tiers: tierNames,
      discord: {
        id: discordUser.id,
        username: discordUser.username,
      },
    })
  } catch (err) {
    console.error('Discord verify error:', err)
    return NextResponse.json({ error: 'verification failed' }, { status: 500 })
  }
}
