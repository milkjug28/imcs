import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { normalizeTrait } from '../src/lib/trait-normalize'

const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.+)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const METADATA_DIR = resolve(__dirname, '../data/metadata')
const IPFS_GATEWAY = 'https://maroon-adequate-gazelle-687.mypinata.cloud/ipfs/'
const shouldWrite = process.argv.includes('--write')

function resolveImage(image: string): string {
  if (image.startsWith('ipfs://')) return IPFS_GATEWAY + image.slice(7)
  return image
}

async function main() {
  const files = readdirSync(METADATA_DIR).filter(f => /^\d+$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b))
  console.log(`Found ${files.length} metadata files`)
  console.log(`Mode: ${shouldWrite ? 'WRITE' : 'DRY RUN'}\n`)

  let filesChanged = 0
  let traitsChanged = 0
  const changeLog: { tokenId: number; trait: string; from: string; to: string }[] = []

  const batch: { token_id: number; name: string; description: string; image: string; attributes: unknown[] }[] = []

  for (const file of files) {
    const filePath = resolve(METADATA_DIR, file)
    const content = readFileSync(filePath, 'utf-8')
    const meta = JSON.parse(content)
    const attributes: { trait_type: string; value: string }[] = meta.attributes || []

    let changed = false
    const normalizedAttrs = attributes.map(a => {
      const normalized = normalizeTrait(a.trait_type, a.value)
      if (normalized !== a.value) {
        changed = true
        traitsChanged++
        changeLog.push({
          tokenId: parseInt(file),
          trait: a.trait_type,
          from: a.value,
          to: normalized,
        })
      }
      return { ...a, value: normalized }
    })

    if (changed) {
      filesChanged++
      meta.attributes = normalizedAttrs

      if (shouldWrite) {
        writeFileSync(filePath, JSON.stringify(meta, null, 4) + '\n')
      }
    }

    batch.push({
      token_id: parseInt(file),
      name: meta.name || `#${file}`,
      description: meta.description || '',
      image: resolveImage(meta.image || ''),
      attributes: normalizedAttrs,
    })
  }

  console.log(`\n=== Summary ===`)
  console.log(`Files changed: ${filesChanged} / ${files.length}`)
  console.log(`Traits changed: ${traitsChanged}`)

  const grouped = new Map<string, Map<string, number>>()
  for (const c of changeLog) {
    const key = `${c.trait}: ${c.from} -> ${c.to}`
    if (!grouped.has(c.trait)) grouped.set(c.trait, new Map())
    const traitMap = grouped.get(c.trait)!
    const changeKey = `${c.from} -> ${c.to}`
    traitMap.set(changeKey, (traitMap.get(changeKey) || 0) + 1)
  }

  console.log(`\n=== Changes by Trait ===`)
  for (const [trait, changes] of grouped) {
    console.log(`\n${trait}:`)
    for (const [change, count] of changes) {
      console.log(`  ${count.toString().padStart(5)}x  ${change}`)
    }
  }

  if (!shouldWrite) {
    console.log(`\nDry run complete. Pass --write to apply changes to JSON files + Supabase.`)
    return
  }

  console.log(`\nUpserting ${batch.length} tokens to savant_metadata...`)
  const CHUNK = 500
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK)
    const { error } = await supabase.from('savant_metadata').upsert(chunk, { onConflict: 'token_id' })
    if (error) {
      console.error(`Error at chunk ${i}:`, error)
      return
    }
    console.log(`  ${Math.min(i + CHUNK, batch.length)} / ${batch.length}`)
  }

  console.log('\nDone! JSON files updated + savant_metadata upserted.')
}

main().catch(console.error)
