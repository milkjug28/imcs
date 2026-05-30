// Uploads all trait layer PNGs (original TRAITS + new-traits + noise) to Arweave
// via Turbo. Produces data/arweave-manifest.json mapping traitId -> gateway URL.
// Resumable: skips files already present in the manifest.
import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk'
import { readFileSync, writeFileSync, existsSync, createReadStream, statSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GEN_DIR = join(ROOT, '..', 'imcs-generation')
const TRAITS_DIR = join(GEN_DIR, 'TRAITS')
const NEW_DIR = join(GEN_DIR, 'new-traits')
const KEY_DIR = join(ROOT, '..', 'arweave-key')
const MANIFEST_PATH = join(ROOT, 'data', 'arweave-manifest.json')

const GATEWAY = 'https://arweave.net'
const SLOT_DIR = ["bg's", 'bods', 'cloths', 'speshul', 'ayezz', 'moufs', 'facessories', 'hatss', 'extruhs', 'textuh']

// --- load key ---
const keyFile = readdirSync(KEY_DIR).find(f => f.endsWith('.json'))
if (!keyFile) { console.error('no arweave key json in', KEY_DIR); process.exit(1) }
const jwk = JSON.parse(readFileSync(join(KEY_DIR, keyFile), 'utf-8'))
const signer = new ArweaveSigner(jwk)
const turbo = TurboFactory.authenticated({ signer })

// --- trait map ---
const traitMap = JSON.parse(readFileSync(join(ROOT, 'data', 'trait-map.json'), 'utf-8'))
const traits = traitMap.traits

// --- build upload list: { key, localPath } where key = traitId or 'noise' ---
const items = []
for (const id in traits) {
  const t = traits[id]
  if (t.hidden) continue // hidden = 0 sentinel, never rendered, no 1155
  let localPath
  if (t.isNew && t.newPath) {
    localPath = join(NEW_DIR, t.newPath)
  } else {
    const dir = SLOT_DIR[t.layer] || t.layerName
    localPath = join(TRAITS_DIR, dir, t.filename)
  }
  if (!existsSync(localPath)) { console.warn('MISSING', id, localPath); continue }
  items.push({ key: String(id), localPath })
}
// noise layer (always composited on top)
const noisePath = join(TRAITS_DIR, 'noise', 'NOISE.png')
if (existsSync(noisePath)) items.push({ key: 'noise', localPath: noisePath })

// --- load existing manifest (resume) ---
let manifest = {}
if (existsSync(MANIFEST_PATH)) manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))

const todo = items.filter(i => !manifest[i.key])
console.log(`total layers: ${items.length}, already uploaded: ${items.length - todo.length}, to upload: ${todo.length}`)

// --- balance ---
try {
  const bal = await turbo.getBalance()
  console.log('turbo balance (winc):', bal.winc)
} catch (e) { console.warn('balance check failed:', e.message) }

// --- upload loop ---
let done = 0
for (const it of todo) {
  const size = statSync(it.localPath).size
  try {
    const res = await turbo.uploadFile({
      fileStreamFactory: () => createReadStream(it.localPath),
      fileSizeFactory: () => size,
      dataItemOpts: { tags: [
        { name: 'Content-Type', value: 'image/png' },
        { name: 'App-Name', value: 'IMCS-Traits' },
        { name: 'Trait-Key', value: it.key },
      ] },
    })
    manifest[it.key] = `${GATEWAY}/${res.id}`
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
    done++
    console.log(`[${done}/${todo.length}] ${it.key} -> ${res.id} (${size}b)`)
  } catch (e) {
    console.error(`FAILED ${it.key}:`, e.message)
  }
}

console.log(`DONE. uploaded ${done}/${todo.length}. manifest -> ${MANIFEST_PATH} (${Object.keys(manifest).length} entries)`)
