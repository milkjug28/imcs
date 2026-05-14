import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY!
const CONTRACT = '0x95fa6fc553F5bE3160b191b0133236367A835C63'

export async function GET(request: NextRequest) {
  const tokenId = request.nextUrl.searchParams.get('tokenId')
  if (!tokenId) return NextResponse.json({ error: 'missing tokenId' }, { status: 400 })

  try {
    const res = await fetch(
      `https://api.opensea.io/api/v2/chain/ethereum/contract/${CONTRACT}/nfts/${tokenId}`,
      { headers: { 'x-api-key': OPENSEA_API_KEY } },
    )
    if (!res.ok) return NextResponse.json({ rank: null })

    const data = await res.json()
    return NextResponse.json({
      rank: data.nft?.rarity?.rank ?? null,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch {
    return NextResponse.json({ rank: null })
  }
}
