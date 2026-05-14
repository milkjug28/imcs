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

const PINATA_GATEWAY = 'https://maroon-adequate-gazelle-687.mypinata.cloud/ipfs/'
const RERENDERED_DIR = resolve(__dirname, '../../imcs-generation/OUTPUT/rerendered')

const NEW_CID = process.argv[2]
if (!NEW_CID) {
  console.error('Usage: npx tsx scripts/update-rerendered-images.ts <NEW_IPFS_CID>')
  process.exit(1)
}

async function main() {
  const files = readdirSync(RERENDERED_DIR).filter(f => f.endsWith('.png'))
  const tokenIds = files.map(f => parseInt(f.replace('.png', ''))).sort((a, b) => a - b)

  console.log(`Updating ${tokenIds.length} tokens with new CID: ${NEW_CID}`)
  console.log(`New image URL format: ${PINATA_GATEWAY}${NEW_CID}/<tokenId>.png`)
  console.log()

  const CHUNK = 100
  let updated = 0

  for (let i = 0; i < tokenIds.length; i += CHUNK) {
    const chunk = tokenIds.slice(i, i + CHUNK)

    for (const tokenId of chunk) {
      const newUrl = `${PINATA_GATEWAY}${NEW_CID}/${tokenId}.png`
      const { error } = await supabase
        .from('savant_metadata')
        .update({ image: newUrl })
        .eq('token_id', tokenId)

      if (error) {
        console.error(`Error updating token ${tokenId}:`, error)
      }
    }

    updated += chunk.length
    console.log(`  ${updated} / ${tokenIds.length}`)
  }

  console.log(`\nDone! ${updated} token image URLs updated.`)
  console.log('Metadata API will now serve new images automatically.')
}

main()
