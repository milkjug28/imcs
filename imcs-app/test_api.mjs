import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [key, val] = line.split('=')
    envVars[key.trim()] = val.trim().replace(/^"|"$/g, '')
  }
}

const supabaseUrl = envVars['SUPABASE_URL'] || envVars['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY']
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const wallet = '0xb05278f8ee6874d5aa55ee63dc397014ba87217f'

  const { data: sub } = await supabase
    .from('submissions')
    .select('*')
    .eq('wallet_address', wallet)
    .single()
    
  console.log("Submission table match:", sub)
}

test()


