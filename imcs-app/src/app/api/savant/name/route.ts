import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { verifyOwnership } from '@/lib/alchemy'

export const dynamic = 'force-dynamic'

const NAME_REGEX = /^[a-zA-Z0-9 _\-'.!?]{1,32}$/

function buildNameMessage(wallet: string, tokenId: number, name: string): string {
  return [
    'Name Your Savant',
    '',
    `Savant #${tokenId}: "${name}"`,
    '',
    `Wallet: ${wallet.toLowerCase()}`,
  ].join('\n')
}

export async function POST(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`savant-name:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  let body: { wallet: string; tokenId: number; name: string; signature: string; message: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { wallet, tokenId, name, signature, message } = body

  if (!wallet || !tokenId || !name || !signature || !message) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const trimmed = name.trim()
  if (!NAME_REGEX.test(trimmed)) {
    return NextResponse.json({ error: 'name must be 1-32 chars, letters/numbers/spaces/basic punctuation only' }, { status: 400 })
  }

  const expectedMessage = buildNameMessage(wallet, tokenId, trimmed)
  if (message !== expectedMessage) {
    return NextResponse.json({ error: 'message mismatch' }, { status: 400 })
  }

  let verified = false
  try {
    verified = await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 400 })
  }

  if (!verified) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  let owns: boolean
  try {
    owns = await verifyOwnership(wallet.toLowerCase(), [tokenId])
  } catch {
    return NextResponse.json({ error: 'ownership check unavailable, try again later' }, { status: 502 })
  }
  if (!owns) {
    return NextResponse.json({ error: 'u dont own this savant' }, { status: 403 })
  }

  const { error } = await supabase
    .from('savant_iq')
    .upsert({
      token_id: tokenId,
      savant_name: trimmed,
      allocated_by: wallet.toLowerCase(),
      last_updated_at: new Date().toISOString(),
    }, { onConflict: 'token_id', ignoreDuplicates: false })

  if (error) {
    console.error('Failed to set savant name:', error)
    return NextResponse.json({ error: 'failed to save name' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tokenId, name: trimmed })
}
