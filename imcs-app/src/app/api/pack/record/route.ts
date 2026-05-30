import { NextRequest, NextResponse } from 'next/server'
import { isAddress, parseAbiItem } from 'viem'
import { supabase } from '@/lib/supabase'
import { getBaseClient } from '@/lib/base-client'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const PACK_ADDRESS = (process.env.NEXT_PUBLIC_PACK_ADDRESS || '') as `0x${string}`
const BOOSTER_WON = parseAbiItem(
  'event BoosterWon(address indexed opener, uint256 indexed requestId, uint256 iqAmount)'
)
const MAX_RANGE = BigInt(10) // Alchemy free-tier eth_getLogs cap
const ONE = BigInt(1)
const MAX_WINDOWS = 300 // bound the scan (~3000 blocks)

async function lifetimeRips(wallet: string): Promise<number> {
  const { count } = await supabase
    .from('pack_rips')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
  return count ?? 0
}

// lifetime rip count for a wallet (persists across reloads)
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase()
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }
  const rips = await lifetimeRips(wallet)
  return NextResponse.json({ wallet, rips }, { headers: { 'Cache-Control': 'no-store' } })
}

// record one rip: insert a row (idempotent on requestId), iq = sum of BoosterWon (0 if none)
export async function POST(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`pack-record:${ip}`, { limit: 20, windowMs: 60_000 })
  if (!rl.success) return NextResponse.json({ error: 'slow down' }, { status: 429 })

  if (!PACK_ADDRESS) return NextResponse.json({ error: 'pack not configured' }, { status: 500 })

  const body = await request.json().catch(() => null)
  const wallet = body?.wallet
  const requestId = body?.requestId
  const fromBlock = body?.fromBlock

  if (!wallet || !isAddress(wallet)) return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  if (requestId === undefined || requestId === null) return NextResponse.json({ error: 'requestId required' }, { status: 400 })
  if (fromBlock === undefined || fromBlock === null) return NextResponse.json({ error: 'fromBlock required' }, { status: 400 })

  const walletLower = (wallet as string).toLowerCase()
  const reqIdStr = String(requestId)

  // already recorded? idempotent on requestId
  const { data: existing } = await supabase
    .from('pack_rips')
    .select('iq_awarded')
    .eq('request_id', reqIdStr)
    .single()
  if (existing) {
    return NextResponse.json({ ok: true, iq: existing.iq_awarded, rips: await lifetimeRips(walletLower), already: true })
  }

  // re-read BoosterWon on-chain for this opener+requestId (trustless), chunked
  let reqIdBig: bigint
  try { reqIdBig = BigInt(reqIdStr) } catch { return NextResponse.json({ error: 'bad requestId' }, { status: 400 }) }

  const client = getBaseClient()
  let head: bigint
  try { head = await client.getBlockNumber() } catch { return NextResponse.json({ error: 'rpc error' }, { status: 502 }) }

  let cursor = BigInt(fromBlock)
  let total = 0
  let windows = 0
  while (cursor <= head && windows < MAX_WINDOWS) {
    const toBlock = cursor + MAX_RANGE - ONE > head ? head : cursor + MAX_RANGE - ONE
    try {
      const logs = await client.getLogs({
        address: PACK_ADDRESS,
        event: BOOSTER_WON,
        args: { opener: wallet as `0x${string}`, requestId: reqIdBig },
        fromBlock: cursor,
        toBlock,
      })
      for (const l of logs) total += Number((l.args as { iqAmount: bigint }).iqAmount)
    } catch {
      return NextResponse.json({ error: 'log scan failed' }, { status: 502 })
    }
    cursor = toBlock + ONE
    windows++
  }

  const { error } = await supabase
    .from('pack_rips')
    .insert({ wallet_address: walletLower, request_id: reqIdStr, iq_awarded: total })

  if (error && error.code !== '23505') {
    console.error('pack-record insert error:', error)
    return NextResponse.json({ error: 'record failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, iq: total, rips: await lifetimeRips(walletLower) })
}
