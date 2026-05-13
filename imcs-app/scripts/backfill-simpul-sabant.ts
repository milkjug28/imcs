import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true })

import { createClient } from '@supabase/supabase-js'

const DISCORD_API = 'https://discord.com/api/v10'
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!
const GUILD_ID = process.env.DISCORD_GUILD_ID!
const SIMPUL_SABANT_ROLE = process.env.SIMPUL_SABANT!

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

async function addRole(userId: string, roleId: string): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/members/${userId}/roles/${roleId}`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  })
  return res.ok || res.status === 204
}

async function main() {
  console.log(`Backfilling simpul sabant role (${SIMPUL_SABANT_ROLE}) for all holders with 1+ savant`)

  const { data: records, error } = await supabase
    .from('discord_verifications')
    .select('discord_user_id, discord_username, token_count')

  if (error || !records) {
    console.error('Failed to fetch records:', error?.message)
    process.exit(1)
  }

  const holders = records.filter(r => r.token_count >= 1)
  console.log(`Found ${holders.length} holders out of ${records.length} total records`)

  let added = 0
  let failed = 0

  for (const holder of holders) {
    try {
      const ok = await addRole(holder.discord_user_id, SIMPUL_SABANT_ROLE)
      if (ok) {
        added++
        console.log(`  ✓ ${holder.discord_username} (${holder.token_count} savants)`)
      } else {
        failed++
        console.log(`  ✗ ${holder.discord_username} - failed (maybe not in server)`)
      }
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      failed++
      console.log(`  ✗ ${holder.discord_username} - error: ${err}`)
    }
  }

  console.log(`\nDone. ${added} roles added, ${failed} failed.`)
}

main()
