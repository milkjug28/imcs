import { NextRequest, NextResponse } from 'next/server'
import { isAddress, getAddress } from 'viem'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/'

type AlchemyNft = {
  tokenId: string
  name: string
  image: { cachedUrl?: string; originalUrl?: string }
  raw: {
    metadata: {
      name: string
      image: string
      attributes: { trait_type: string; value: string | number; max_value?: number }[]
    }
  }
}

function resolveImage(nft: AlchemyNft): string {
  if (nft.image?.cachedUrl) return nft.image.cachedUrl
  const raw = nft.raw?.metadata?.image || ''
  if (raw.startsWith('ipfs://')) return IPFS_GATEWAY + raw.slice(7)
  return raw
}

export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIP(request)
    const rl = rateLimit(`holder:${ip}`, { limit: 15, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json({ error: 'slow down' }, { status: 429 })
    }

    const wallet = request.nextUrl.searchParams.get('wallet')
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
    }

    const checksummed = getAddress(wallet)

    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${checksummed}&contractAddresses[]=${SAVANT_TOKEN}&withMetadata=true&pageSize=100`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'alchemy error' }, { status: 502 })
    }

    const data = await res.json()
    const nfts = (data.ownedNfts || []) as AlchemyNft[]

    const tokens = nfts.map(nft => {
      const attrs = nft.raw?.metadata?.attributes || []
      const iq = attrs.find(a => a.trait_type === 'IQ')
      return {
        tokenId: nft.tokenId,
        name: nft.raw?.metadata?.name || `#${nft.tokenId}`,
        image: resolveImage(nft),
        iq: iq ? Number(iq.value) : 69,
        traits: attrs.filter(a => a.trait_type !== 'IQ' && a.trait_type !== 'Trait Count').map(a => ({
          type: a.trait_type,
          value: String(a.value),
        })),
      }
    })

    return NextResponse.json({
      wallet: checksummed,
      balance: tokens.length,
      tokens,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
    })
  } catch {
    return NextResponse.json({ error: 'failed to fetch holdings' }, { status: 500 })
  }
}
