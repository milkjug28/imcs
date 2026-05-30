import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { traits } from '@/lib/trait-data'
import arweaveManifest from '../../../../../../imcs-deployment/data/arweave-manifest.json'

const TRAITS_DIR = join(process.cwd(), '..', 'imcs-generation', 'TRAITS')
const NEW_TRAITS_DIR = join(process.cwd(), '..', 'imcs-generation', 'new-traits')
const manifest = arweaveManifest as Record<string, string>

// Reverse lookup: resolved layer source path -> traitId (for Arweave fallback).
const pathToTraitId = new Map<string, string>()
for (const id in traits) {
  const t = traits[id]
  if (t.isNew && t.newPath) {
    pathToTraitId.set(`new:${t.newPath}`, id)
  } else {
    pathToTraitId.set(`old:${t.layerName}/${t.filename}`, id)
  }
}

export async function GET(request: NextRequest) {
  const layer = request.nextUrl.searchParams.get('layer')
  const file = request.nextUrl.searchParams.get('file')
  const isNew = request.nextUrl.searchParams.get('new') === '1'
  const sub = request.nextUrl.searchParams.get('sub')

  if (!layer || !file) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  if (file.includes('..') || layer.includes('..') || (sub && sub.includes('..'))) {
    return NextResponse.json({ error: 'nah' }, { status: 400 })
  }

  let filePath: string
  let traitKey: string
  if (isNew && sub) {
    filePath = join(NEW_TRAITS_DIR, layer, sub, file)
    traitKey = `new:${layer}/${sub}/${file}`
  } else if (isNew) {
    filePath = join(NEW_TRAITS_DIR, layer, file)
    traitKey = `new:${layer}/${file}`
  } else {
    filePath = join(TRAITS_DIR, layer, file)
    traitKey = `old:${layer}/${file}`
  }

  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    // local miss (e.g. prod where the generation dir isn't bundled) -> Arweave
    const id = pathToTraitId.get(traitKey)
    const url = id ? manifest[id] : undefined
    if (url) return NextResponse.redirect(url, 308)
    return NextResponse.json({ error: 'trait not found' }, { status: 404 })
  }
}
