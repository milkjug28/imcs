import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getBaseIQ } from '@/lib/iq'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export const dynamic = 'force-dynamic'

const METADATA_DIR = resolve(process.cwd(), '../imcs-deployment/metadata-nojson')

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
      .select('iq_points, savant_name')
      .eq('token_id', tokenId)
      .single()

    const allocated = iqRow?.iq_points ?? 0
    const totalIQ = getBaseIQ(tokenId) + allocated
    const savantName = iqRow?.savant_name || null

    const attributes = (rawMeta.attributes as { trait_type: string; value: string }[]) || []

    attributes.push({
      trait_type: 'IQ',
      value: String(totalIQ),
    })

    if (savantName) {
      attributes.push({
        trait_type: 'Savant Name',
        value: savantName,
      })
    }

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
