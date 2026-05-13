import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

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

function resolveImage(image: string): string {
  if (image.startsWith('ipfs://')) return IPFS_GATEWAY + image.slice(7)
  return image
}

async function importMetadata() {
  const files = readdirSync(METADATA_DIR).filter(f => /^\d+$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b))
  console.log(`Found ${files.length} metadata files`)

  const batch: { token_id: number; name: string; description: string; image: string; attributes: unknown[] }[] = []

  for (const file of files) {
    const content = readFileSync(resolve(METADATA_DIR, file), 'utf-8')
    const meta = JSON.parse(content)
    batch.push({
      token_id: parseInt(file),
      name: meta.name || `#${file}`,
      description: meta.description || '',
      image: resolveImage(meta.image || ''),
      attributes: meta.attributes || [],
    })
  }

  console.log(`Importing ${batch.length} tokens...`)

  const CHUNK = 500
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK)
    const { error } = await supabase.from('savant_metadata').upsert(chunk, { onConflict: 'token_id' })
    if (error) {
      console.error(`Error at chunk ${i}:`, error)
      return
    }
    console.log(`  Imported ${Math.min(i + CHUNK, batch.length)} / ${batch.length}`)
  }

  console.log('Done!')
}

importMetadata()
