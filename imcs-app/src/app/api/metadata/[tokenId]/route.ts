import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getBaseIQ } from '@/lib/iq'
import { normalizeTrait } from '@/lib/trait-normalize'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  const tokenId = parseInt(params.tokenId)
  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: 'invalid token id' }, { status: 400 })
  }

  try {
    const [metaResult, iqResult] = await Promise.all([
      supabase
        .from('savant_metadata')
        .select('name, description, image, attributes')
        .eq('token_id', tokenId)
        .single(),
      supabase
        .from('savant_iq')
        .select('iq_points, savant_name')
        .eq('token_id', tokenId)
        .single(),
    ])

    if (!metaResult.data) {
      return NextResponse.json({ error: 'token not found' }, { status: 404 })
    }

    const meta = metaResult.data
    const allocated = iqResult.data?.iq_points ?? 0
    const totalIQ = getBaseIQ(tokenId) + allocated
    const savantName = iqResult.data?.savant_name || null

    const rawAttributes = (meta.attributes as { trait_type: string; value: string }[] || [])
    const attributes = rawAttributes.map(a => ({
      trait_type: a.trait_type,
      value: normalizeTrait(a.trait_type, a.value),
    }))

    attributes.push({
      trait_type: 'IQ',
      value: String(totalIQ),
    })

    return NextResponse.json({
      name: meta.name,
      description: meta.description,
      image: meta.image,
      ...(savantName && { savant_name: savantName }),
      attributes,
    }, {
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
