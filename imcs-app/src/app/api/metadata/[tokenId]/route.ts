import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export const dynamic = 'force-dynamic'

const METADATA_DIR = resolve(process.cwd(), '../imcs-deployment/metadata-nojson')
const IQ_FLOOR = 69

export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  const tokenId = parseInt(params.tokenId)
  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: 'invalid token id' }, { status: 400 })
  }

  try {
    let rawMeta: Record<string, unknown>
    try {
      const content = readFileSync(resolve(METADATA_DIR, String(tokenId)), 'utf-8')
      rawMeta = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'token not found' }, { status: 404 })
    }

    const { data: iqRow } = await supabase
      .from('savant_iq')
      .select('iq_points')
      .eq('token_id', tokenId)
      .single()

    const iqPoints = iqRow?.iq_points ?? IQ_FLOOR

    const attributes = (rawMeta.attributes as { trait_type: string; value: string }[]) || []

    attributes.push({
      trait_type: 'IQ',
      value: String(iqPoints),
    })

    return NextResponse.json({
      name: rawMeta.name,
      description: rawMeta.description,
      image: rawMeta.image,
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
