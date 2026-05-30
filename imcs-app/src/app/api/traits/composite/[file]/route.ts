import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Pretty image URL for savant composites. Metadata stores
//   https://imcs.world/api/traits/composite/<tokenId>.png?v=<ts>
// and this route 307-redirects to the underlying Supabase Storage object.
// The ?v= cache-bust lives on this proxy URL (the metadata image field), so
// OpenSea refetches on every equip; the redirect target is the stable bucket path.
const BUCKET = 'savant-composites'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { file: string } }
) {
  const match = params.file.match(/^(\d+)\.png$/)
  if (!match) {
    return NextResponse.json({ error: 'bad file' }, { status: 400 })
  }
  const tokenId = parseInt(match[1])
  if (tokenId < 1 || tokenId > 4269) {
    return NextResponse.json({ error: 'invalid token id' }, { status: 400 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${tokenId}.png`)
  return NextResponse.redirect(data.publicUrl, 307)
}
