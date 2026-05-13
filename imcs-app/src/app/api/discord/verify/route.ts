import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isAddress, getAddress, recoverMessageAddress } from 'viem'
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

async function getTotalHoldings(discordUserId: string): Promise<{ total: number; wallets: { address: string; count: number }[] }> {
  const { data: wallets } = await supabase
    .from('discord_wallets')
    .select('wallet_address, token_count')
    .eq('discord_user_id', discordUserId)

  if (!wallets || wallets.length === 0) return { total: 0, wallets: [] }

  const result = wallets.map(w => ({ address: w.wallet_address, count: w.token_count }))
  const total = result.reduce((sum, w) => sum + w.count, 0)
  return { total, wallets: result }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIP(request)
    const rl = rateLimit(`discord-verify:${ip}`, { limit: 5, windowMs: 300_000 })
    if (!rl.success) {
      return NextResponse.json({ error: 'slow down nerd' }, { status: 429 })
    }

    const body = await request.json()
    const { wallet, signature, message } = body

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
    }

    if (!signature || !message) {
      return NextResponse.json({ error: 'signature required to prove wallet ownership' }, { status: 400 })
    }

    const checksummedEarly = getAddress(wallet)
    const recovered = await recoverMessageAddress({ message, signature })
    if (getAddress(recovered) !== checksummedEarly) {
      return NextResponse.json({ error: 'signature doesnt match wallet' }, { status: 401 })
    }

    const tsMatch = message.match(/Timestamp: (\d+)/)
    if (!tsMatch || Math.abs(Date.now() - Number(tsMatch[1])) > 300_000) {
      return NextResponse.json({ error: 'signature expired. try agen' }, { status: 401 })
    }

    const cookieStore = await cookies()
    const accessToken = cookieStore.get('discord_access_token')?.value
    const sessionUserId = cookieStore.get('discord_session')?.value

    let discordUser: { id: string; username: string }

    if (accessToken) {
      const user = await getDiscordUser(accessToken)
      discordUser = { id: user.id, username: user.username }
    } else if (sessionUserId) {
      const { data: sessionData } = await supabase
        .from('discord_verifications')
        .select('discord_user_id, discord_username')
        .eq('discord_user_id', sessionUserId)
        .single()
      if (!sessionData) {
        return NextResponse.json({ error: 'session expired. link discord agen' }, { status: 401 })
      }
      discordUser = { id: sessionData.discord_user_id, username: sessionData.discord_username }
    } else {
      return NextResponse.json({ error: 'discord not linked. connect discord first' }, { status: 401 })
    }

    const checksummed = getAddress(wallet)
    const walletCount = await getHoldings(checksummed)

    // Check if wallet is already linked to a different discord user
    const { data: existingLink } = await supabase
      .from('discord_wallets')
      .select('discord_user_id')
      .eq('wallet_address', checksummed)
      .single()

    if (existingLink && existingLink.discord_user_id !== discordUser.id) {
      return NextResponse.json({
        success: false,
        message: 'dis wallet already linked 2 another discord account',
      }, { status: 409 })
    }

    // Upsert the discord user record
    const { error: userError } = await supabase
      .from('discord_verifications')
      .upsert({
        discord_user_id: discordUser.id,
        discord_username: discordUser.username,
        wallet_address: checksummed,
        verified_at: new Date().toISOString(),
        last_checked: new Date().toISOString(),
      }, { onConflict: 'discord_user_id' })

    if (userError) {
      console.error('Supabase user upsert error:', userError)
      return NextResponse.json({ error: 'database error' }, { status: 500 })
    }

    // Upsert the wallet link
    const { error: walletError } = await supabase
      .from('discord_wallets')
      .upsert({
        discord_user_id: discordUser.id,
        wallet_address: checksummed,
        token_count: walletCount,
        linked_at: new Date().toISOString(),
      }, { onConflict: 'wallet_address' })

    if (walletError) {
      console.error('Supabase wallet upsert error:', walletError)
      return NextResponse.json({ error: 'database error' }, { status: 500 })
    }

    // Get total across all linked wallets
    const { total, wallets } = await getTotalHoldings(discordUser.id)

    // Update the main record with total
    const tiers = getTiersForCount(total)
    const tierNames = tiers.map(t => t.name)

    await supabase
      .from('discord_verifications')
      .update({
        token_count: total,
        tiers: tierNames,
        last_checked: new Date().toISOString(),
      })
      .eq('discord_user_id', discordUser.id)

    await assignTierRoles(GUILD_ID, discordUser.id, total)

    if (accessToken) {
      cookieStore.delete('discord_access_token')
    }

    cookieStore.set('discord_session', discordUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 604800,
    })

    return NextResponse.json({
      success: true,
      message: total >= 51
        ? 'ABSULUT CHED SAVANAT!!! u ar da goat'
        : total >= 25
        ? 'CHED SAVANT DETECTED!!! u ar legend'
        : total >= 6
        ? 'supa savants status achieved. respekt'
        : total >= 2
        ? 'reel sabant energy. nice'
        : total >= 1
        ? 'simpul sabant detected. welcum 2 savant wurld'
        : 'u dont hold any savants across ur wallets, dummie',
      tokenCount: total,
      tiers: tierNames,
      wallets,
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
