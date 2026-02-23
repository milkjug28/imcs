/**
 * Run SQL migration to add claim columns to whitelist table
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrate() {
  const columns = [
    { name: 'x_username', type: 'TEXT' },
    { name: 'x_user_id', type: 'TEXT' },
    { name: 'tweet_link', type: 'TEXT' },
    { name: 'claimed', type: 'BOOLEAN DEFAULT FALSE' },
    { name: 'claimed_at', type: 'TIMESTAMP' },
  ]

  for (const col of columns) {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
    })
    
    if (error) {
      // Try direct query if RPC doesn't exist
      const { error: directError } = await supabase
        .from('whitelist')
        .select(col.name)
        .limit(1)
      
      if (directError && directError.message.includes('does not exist')) {
        console.log(`Column ${col.name} needs to be added manually via Supabase SQL editor`)
      } else {
        console.log(`Column ${col.name} already exists or added successfully`)
      }
    } else {
      console.log(`Added column: ${col.name}`)
    }
  }

  console.log('\nDone! If any columns need manual adding, run this SQL in Supabase SQL editor:')
  console.log('---')
  console.log(`ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS x_username TEXT;`)
  console.log(`ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS x_user_id TEXT;`)
  console.log(`ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS tweet_link TEXT;`)
  console.log(`ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT FALSE;`)
  console.log(`ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;`)
}

migrate().catch(console.error)
