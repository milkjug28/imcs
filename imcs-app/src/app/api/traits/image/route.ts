import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const TRAITS_DIR = join(process.cwd(), '..', 'imcs-generation', 'TRAITS')
const NEW_TRAITS_DIR = join(process.cwd(), '..', 'imcs-generation', 'new-traits')

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
  if (isNew && sub) {
    filePath = join(NEW_TRAITS_DIR, layer, sub, file)
  } else if (isNew) {
    filePath = join(NEW_TRAITS_DIR, layer, file)
  } else {
    filePath = join(TRAITS_DIR, layer, file)
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
    return NextResponse.json({ error: 'trait not found' }, { status: 404 })
  }
}
