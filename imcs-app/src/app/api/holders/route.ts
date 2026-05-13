import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'

type OwnerEntry = {
  ownerAddress: string
  tokenBalances: { balance: string }[]
}

let cachedData: { holders: { wallet: string; count: number }[]; fetchedAt: number } | null = null
const CACHE_TTL = 300_000 // 5 min

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.fetchedAt < CACHE_TTL) {
      return NextResponse.json(cachedData.holders, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      })
    }

    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getOwnersForContract?contractAddress=${SAVANT_TOKEN}&withTokenBalances=true`
    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      return NextResponse.json({ error: 'alchemy error' }, { status: 502 })
    }

    const data = await res.json()
    const owners = (data.owners || []) as OwnerEntry[]

    const holders = owners
      .map(o => ({
        wallet: o.ownerAddress,
        count: o.tokenBalances.reduce((sum, tb) => sum + parseInt(tb.balance || '0'), 0),
      }))
      .filter(h => h.count > 0 && h.wallet.toLowerCase() !== '0x6878144669e7e558737feb3820410174ceef04e6')
      .sort((a, b) => b.count - a.count)

    cachedData = { holders, fetchedAt: Date.now() }

    return NextResponse.json(holders, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json({ error: 'failed to fetch holders' }, { status: 500 })
  }
}
