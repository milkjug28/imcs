// Uploads the card-pack image to Arweave via Turbo and records it in
// data/arweave-manifest.json under key "999000" (the pack token id).
import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk'
import { readFileSync, writeFileSync, existsSync, createReadStream, statSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const KEY_DIR = join(ROOT, '..', 'arweave-key')
const MANIFEST_PATH = join(ROOT, 'data', 'arweave-manifest.json')
const IMG = join(ROOT, '..', 'imcs-app', 'public', 'assets', 'card-pack.png')
const KEY = '999000'
const GATEWAY = 'https://arweave.net'

if (!existsSync(IMG)) { console.error('missing', IMG); process.exit(1) }

const keyFile = readdirSync(KEY_DIR).find(f => f.endsWith('.json'))
const jwk = JSON.parse(readFileSync(join(KEY_DIR, keyFile), 'utf-8'))
const turbo = TurboFactory.authenticated({ signer: new ArweaveSigner(jwk) })

const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) : {}
if (manifest[KEY]) { console.log('already uploaded:', manifest[KEY]); process.exit(0) }

const size = statSync(IMG).size
try { const bal = await turbo.getBalance(); console.log('turbo balance (winc):', bal.winc) } catch (e) { console.warn('balance check failed:', e.message) }
console.log(`uploading card-pack.png (${size}b)...`)

const res = await turbo.uploadFile({
  fileStreamFactory: () => createReadStream(IMG),
  fileSizeFactory: () => size,
  dataItemOpts: { tags: [
    { name: 'Content-Type', value: 'image/png' },
    { name: 'App-Name', value: 'IMCS-Traits' },
    { name: 'Trait-Key', value: KEY },
  ] },
})
manifest[KEY] = `${GATEWAY}/${res.id}`
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
console.log(`pack image -> ${manifest[KEY]}`)
