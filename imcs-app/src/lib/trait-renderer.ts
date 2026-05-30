/**
 * Server-side savant composite renderer.
 * Given a 10-slot equipment array (traitIds, 0 = empty), composites the trait
 * layer PNGs into a single 1000x1000 image, matching the original generation
 * pipeline draw order (see imcs-generation/rerender.py).
 *
 * Layer source: local imcs-generation dir first (fast, dev), falling back to
 * Arweave via the manifest when the local file is absent (prod / Vercel, where
 * the generation dir isn't bundled). Manifest keys: traitId (string) + 'noise'.
 */
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { traits, NUM_SLOTS } from '@/lib/trait-data'
import arweaveManifest from '../../../imcs-deployment/data/arweave-manifest.json'

const manifest = arweaveManifest as Record<string, string>

const TRAITS_DIR = join(process.cwd(), '..', 'imcs-generation', 'TRAITS')
const NEW_TRAITS_DIR = join(process.cwd(), '..', 'imcs-generation', 'new-traits')

async function fetchArweave(key: string): Promise<Buffer | null> {
  const url = manifest[key]
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}
const IMAGE_SIZE = 1000

// Draw order by slot index (matches rerender.py LAYER_ORDER 0..9). noise on top.
const SLOT_DRAW_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

// Per-token layer swaps (from rerender.py) for buggy original art.
const SWAP_HATSS_BEFORE_MOUFS = new Set([1025, 3163, 3367])
const SWAP_HATSS_BEFORE_AYEZZ = new Set([4122])

// slot index -> directory name under TRAITS/
const SLOT_DIR = ["bg's", 'bods', 'cloths', 'speshul', 'ayezz', 'moufs', 'facessories', 'hatss', 'extruhs', 'textuh']

function drawOrderFor(tokenId: number): number[] {
  const order = [...SLOT_DRAW_ORDER]
  const move = (slot: number, afterSlot: number) => {
    const i = order.indexOf(slot)
    if (i !== -1) order.splice(i, 1)
    order.splice(order.indexOf(afterSlot) + 1, 0, slot)
  }
  if (SWAP_HATSS_BEFORE_MOUFS.has(tokenId)) move(5, 7) // moufs after hatss
  if (SWAP_HATSS_BEFORE_AYEZZ.has(tokenId)) move(4, 7) // ayezz after hatss
  return order
}

async function loadLayer(slot: number, traitId: number): Promise<Buffer | null> {
  if (traitId <= 0) return null
  const info = traits[traitId]
  if (!info) return null
  try {
    if (info.isNew && info.newPath) {
      return await readFile(join(NEW_TRAITS_DIR, info.newPath))
    }
    const dir = SLOT_DIR[slot] || info.layerName
    return await readFile(join(TRAITS_DIR, dir, info.filename))
  } catch {
    return fetchArweave(String(traitId))
  }
}

/**
 * Composite a savant from its equipment slots. Returns a PNG buffer.
 * @param slots length-10 array of traitIds (0 = empty slot)
 * @param tokenId used only to apply per-token draw-order swaps
 */
export async function compositeSavant(slots: number[], tokenId: number): Promise<Buffer> {
  if (slots.length < NUM_SLOTS) {
    slots = [...slots, ...Array(NUM_SLOTS - slots.length).fill(0)]
  }

  const order = drawOrderFor(tokenId)
  const overlays: sharp.OverlayOptions[] = []

  for (const slot of order) {
    const buf = await loadLayer(slot, slots[slot])
    if (buf) overlays.push({ input: await normalize(buf) })
  }

  // noise always on top
  let noise: Buffer | null = null
  try {
    noise = await readFile(join(TRAITS_DIR, 'noise', 'NOISE.png'))
  } catch {
    noise = await fetchArweave('noise')
  }
  if (noise) overlays.push({ input: await normalize(noise) })

  const base = sharp({
    create: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })

  return base.composite(overlays).png().toBuffer()
}

// Ensure each layer is exactly IMAGE_SIZE so composite offsets line up.
async function normalize(buf: Buffer): Promise<Buffer> {
  return sharp(buf).resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'fill' }).png().toBuffer()
}
