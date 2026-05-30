import { NextRequest, NextResponse } from 'next/server'
import { traits } from '@/lib/trait-data'
import { boosterPct } from '@/lib/trait-boosters'
import arweaveManifest from '../../../../../../../imcs-deployment/data/arweave-manifest.json'

const manifest = arweaveManifest as Record<string, string>
const DESCRIPTION = 'ekwip/unekwip ur trayts or sell dem on da opin sees.'
const PACK_TOKEN_ID = Number(process.env.NEXT_PUBLIC_PACK_TOKEN_ID || 999000)

// ERC1155 marketplaces substitute {id} in the contract uri with the lowercase
// hex token id zero-padded to 64 chars; our app requests plain decimal. Accept both.
function parseTokenId(s: string): number {
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Number(BigInt('0x' + s))
  if (s.startsWith('0x')) return Number(BigInt(s))
  return parseInt(s, 10)
}

function traitImage(traitId: number, origin: string): string {
  const url = manifest[String(traitId)]
  if (url) return url
  const t = traits[traitId]
  if (t?.isNew && t.newPath) {
    const parts = t.newPath.split('/')
    if (parts.length === 3) {
      return `${origin}/api/traits/image?new=1&layer=${encodeURIComponent(parts[0])}&sub=${encodeURIComponent(parts[1])}&file=${encodeURIComponent(parts[2])}`
    }
    return `${origin}/api/traits/image?new=1&layer=${encodeURIComponent(parts[0])}&file=${encodeURIComponent(parts[1])}`
  }
  return `${origin}/api/traits/image?layer=${encodeURIComponent(t.layerName)}&file=${encodeURIComponent(t.filename)}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { traitId: string } }
) {
  const traitId = parseTokenId(params.traitId)

  if (traitId === PACK_TOKEN_ID) {
    return NextResponse.json({
      name: 'IMCS trayt pak',
      description: 'rip n ekwip',
      image: manifest[String(PACK_TOKEN_ID)],
      attributes: [{ trait_type: 'szn', value: '1' }],
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
      },
    })
  }

  const trait = traits[traitId]
  if (isNaN(traitId) || !trait) {
    return NextResponse.json({ error: 'trait not found' }, { status: 404 })
  }

  const origin = request.nextUrl.origin
  const attributes: { trait_type: string; value: string }[] = [
    { trait_type: 'type', value: trait.layerName },
  ]

  const pct = boosterPct(traitId)
  if (pct > 0) {
    attributes.push({ trait_type: 'buustur', value: `wen ekwipt sabant IQ grohs ${pct}%!` })
  }

  return NextResponse.json({
    name: trait.name,
    description: DESCRIPTION,
    image: traitImage(traitId, origin),
    attributes,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Content-Type': 'application/json',
    },
  })
}
