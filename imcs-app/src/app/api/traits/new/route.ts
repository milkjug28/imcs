import { NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'

const NEW_TRAITS_DIR = join(process.cwd(), '..', 'imcs-generation', 'new-traits')

const LAYER_INDEX: Record<string, number> = {
  "bg's": 0, bods: 1, cloths: 2, speshul: 3, ayezz: 4,
  moufs: 5, facessories: 6, hatss: 7, extruhs: 8, textuh: 9,
}

export type NewTrait = {
  id: string
  name: string
  layer: number
  layerName: string
  filename: string
  isNew: true
  sub?: string
  variants?: string[]
}

export async function GET() {
  const traits: NewTrait[] = []

  let layers: string[]
  try {
    layers = await readdir(NEW_TRAITS_DIR)
  } catch {
    return NextResponse.json({ traits: [] })
  }

  for (const layer of layers) {
    if (layer.startsWith('.')) continue
    const layerIdx = LAYER_INDEX[layer]
    if (layerIdx === undefined) continue
    const layerPath = join(NEW_TRAITS_DIR, layer)
    const entries = await readdir(layerPath)

    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const entryPath = join(layerPath, entry)
      const s = await stat(entryPath)

      if (s.isDirectory()) {
        const variants = await readdir(entryPath)
        const pngs = variants.filter(v => v.endsWith('.png'))
        traits.push({
          id: `new_${layer}_${entry}`,
          name: entry,
          layer: layerIdx,
          layerName: layer,
          filename: '',
          isNew: true,
          sub: entry,
          variants: pngs.map(p => p.replace('.png', '')),
        })
      } else if (entry.endsWith('.png')) {
        traits.push({
          id: `new_${layer}_${entry.replace('.png', '')}`,
          name: entry.replace('.png', ''),
          layer: layerIdx,
          layerName: layer,
          filename: entry,
          isNew: true,
        })
      }
    }
  }

  return NextResponse.json({ traits })
}
