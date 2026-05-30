// READ-ONLY precheck: confirm `available` is generated, PG version, and any dependents
// (views) on wallet_iq_balances.available before we DROP/ADD the column.
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const file of ['.env', '.env.local']) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL
async function run() {
  if (!conn) {
    console.log('No direct Postgres URL in env (SUPABASE_DB_URL/DATABASE_URL/POSTGRES_URL).')
    console.log('Skipping live precheck — falling back to supabase-js dependent check.')
    return supaCheck()
  }
  const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  const ver = await pool.query('SHOW server_version')
  console.log('PG version:', ver.rows[0].server_version)

  const col = await pool.query(`
    SELECT column_name, data_type, is_generated, generation_expression
    FROM information_schema.columns
    WHERE table_name = 'wallet_iq_balances' AND column_name = 'available'
  `)
  console.log('available column:', col.rows[0])

  const deps = await pool.query(`
    SELECT DISTINCT v.table_name AS view_name
    FROM information_schema.view_column_usage v
    WHERE v.table_name <> 'wallet_iq_balances'
      AND v.column_name = 'available'
      AND v.table_schema = 'public'
  `)
  console.log('Views depending on available:', deps.rows.length ? deps.rows : 'none')
  await pool.end()
}

async function supaCheck() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { error } = await supabase.rpc('version')
  console.log('(supabase-js cannot read information_schema directly without an RPC)')
  console.log('rpc version err (expected):', error?.message)
}

run().catch(e => { console.error(e); process.exit(1) })
