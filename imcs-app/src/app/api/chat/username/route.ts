import { NextRequest, NextResponse } from 'next/server'
import { isAddress, getAddress } from 'viem'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
  }

  const checksummed = getAddress(wallet)
  const { data } = await supabase
    .from('chat_usernames')
    .select('username')
    .eq('wallet_address', checksummed)
    .single()

  return NextResponse.json({ username: data?.username || null })
}

export async function POST(req: NextRequest) {
  const { wallet, username } = await req.json()

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
  }

  const trimmed = username?.trim()
  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
    return NextResponse.json({ error: 'Username must be 2-20 characters' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return NextResponse.json({ error: 'Letters, numbers, underscores only' }, { status: 400 })
  }

  const checksummed = getAddress(wallet)

  const { data: existing } = await supabase
    .from('chat_usernames')
    .select('wallet_address')
    .ilike('username', trimmed)
    .neq('wallet_address', checksummed)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Username taken' }, { status: 409 })
  }

  const { error } = await supabase
    .from('chat_usernames')
    .upsert(
      { wallet_address: checksummed, username: trimmed },
      { onConflict: 'wallet_address' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, username: trimmed })
}
