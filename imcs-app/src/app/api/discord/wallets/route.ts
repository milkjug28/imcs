import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isAddress, getAddress, recoverMessageAddress } from 'viem'
import { supabase } from '@/lib/supabase'
import { assignTierRoles, getTiersForCount } from '@/lib/discord'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const GUILD_ID = process.env.DISCORD_GUILD_ID!

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }

  const checksummed = getAddress(wallet)

  const { data: walletRecord } = await supabase
    .from('discord_wallets')
    .select('discord_user_id, token_count')
    .eq('wallet_address', checksummed)
    .single()

  if (!walletRecord) {
    const cookieStore = await cookies()
    const sessionUserId = cookieStore.get('discord_session')?.value

    if (sessionUserId) {
      const { data: sessionUser } = await supabase
        .from('discord_verifications')
        .select('discord_username')
        .eq('discord_user_id', sessionUserId)
        .single()

      if (sessionUser) {
        return NextResponse.json({
          found: false,
          discordSession: { username: sessionUser.discord_username },
        })
      }
    }

    return NextResponse.json({ found: false })
  }

  const { data: userRecord } = await supabase
    .from('discord_verifications')
    .select('discord_user_id, discord_username, token_count, tiers')
    .eq('discord_user_id', walletRecord.discord_user_id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ found: false })
  }

  const { data: allWallets } = await supabase
    .from('discord_wallets')
    .select('wallet_address, token_count')
    .eq('discord_user_id', walletRecord.discord_user_id)

  return NextResponse.json({
    found: true,
    discord: {
      id: userRecord.discord_user_id,
      username: userRecord.discord_username,
    },
    tokenCount: userRecord.token_count,
    tiers: userRecord.tiers || [],
    wallets: (allWallets || []).map(w => ({
      address: w.wallet_address,
      count: w.token_count,
    })),
  })
}

export async function DELETE(request: NextRequest) {
  try {
    const ip = getRequestIP(request)
    const rl = rateLimit(`discord-unlink:${ip}`, { limit: 5, windowMs: 300_000 })
    if (!rl.success) {
      return NextResponse.json({ error: 'slow down nerd' }, { status: 429 })
    }

    const body = await request.json()
    const { wallet, signature, message } = body

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
    }
    if (!signature || !message) {
      return NextResponse.json({ error: 'signature required' }, { status: 400 })
    }

    const checksummed = getAddress(wallet)

    const recovered = await recoverMessageAddress({ message, signature })
    if (getAddress(recovered) !== checksummed) {
      return NextResponse.json({ error: 'signature doesnt match wallet' }, { status: 401 })
    }

    const tsMatch = message.match(/Timestamp: (\d+)/)
    if (!tsMatch || Math.abs(Date.now() - Number(tsMatch[1])) > 300_000) {
      return NextResponse.json({ error: 'signature expired' }, { status: 401 })
    }

    const { data: walletRecord } = await supabase
      .from('discord_wallets')
      .select('discord_user_id')
      .eq('wallet_address', checksummed)
      .single()

    if (!walletRecord) {
      return NextResponse.json({ error: 'wallet not linked' }, { status: 404 })
    }

    const discordUserId = walletRecord.discord_user_id

    await supabase
      .from('discord_wallets')
      .delete()
      .eq('wallet_address', checksummed)

    const { data: remaining } = await supabase
      .from('discord_wallets')
      .select('wallet_address, token_count')
      .eq('discord_user_id', discordUserId)

    const newTotal = (remaining || []).reduce((sum, w) => sum + w.token_count, 0)
    const tiers = getTiersForCount(newTotal)
    const tierNames = tiers.map(t => t.name)

    await supabase
      .from('discord_verifications')
      .update({
        token_count: newTotal,
        tiers: tierNames.length > 0 ? tierNames : null,
        last_checked: new Date().toISOString(),
      })
      .eq('discord_user_id', discordUserId)

    await assignTierRoles(GUILD_ID, discordUserId, newTotal)

    return NextResponse.json({
      success: true,
      tokenCount: newTotal,
      tiers: tierNames,
      wallets: (remaining || []).map(w => ({
        address: w.wallet_address,
        count: w.token_count,
      })),
    })
  } catch (err) {
    console.error('Wallet unlink error:', err)
    return NextResponse.json({ error: 'unlink failed' }, { status: 500 })
  }
}
