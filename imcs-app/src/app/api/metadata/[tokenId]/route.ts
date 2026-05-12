import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const IQ_FLOOR = 69

type AlchemyAttribute = {
  trait_type: string
  value: string | number
  display_type?: string
  max_value?: number
}

type AlchemyNftResponse = {
  raw?: {
    metadata?: {
      name?: string
      description?: string
      image?: string
      attributes?: AlchemyAttribute[]
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  const tokenId = parseInt(params.tokenId)
  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: 'invalid token id' }, { status: 400 })
  }

  try {
    const [nftRes, iqRow] = await Promise.all([
      fetch(
        `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${SAVANT_TOKEN}&tokenId=${tokenId}&refreshCache=false`,
        { next: { revalidate: 3600 } }
      ),
      supabase
        .from('savant_iq')
        .select('iq_points')
        .eq('token_id', tokenId)
        .single(),
    ])

    if (!nftRes.ok) {
      return NextResponse.json({ error: 'token not found' }, { status: 404 })
    }

    const nftData: AlchemyNftResponse = await nftRes.json()
    const rawMeta = nftData.raw?.metadata

    if (!rawMeta) {
      return NextResponse.json({ error: 'no metadata' }, { status: 404 })
    }

    const iqPoints = iqRow.data?.iq_points ?? IQ_FLOOR

    const attributes: AlchemyAttribute[] = (rawMeta.attributes || [])
      .filter(a => a.trait_type !== 'IQ' && a.trait_type !== 'Trait Count')

    attributes.push({
      trait_type: 'IQ',
      value: iqPoints,
      display_type: 'number',
      max_value: 420,
    })

    const metadata = {
      name: rawMeta.name || `Savant #${tokenId}`,
      description: rawMeta.description || 'an imaginary magic crypto savant',
      image: rawMeta.image || '',
      attributes,
    }

    return NextResponse.json(metadata, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Metadata error:', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
