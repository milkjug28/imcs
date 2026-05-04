/**
 * Generate Merkle Trees for Mint Phases
 *
 * Queries whitelist table, builds 3 trees (GTD, Community, FCFS)
 * using the PROVEN pattern from hyperblocks2:
 *   - @openzeppelin/merkle-tree SimpleMerkleTree
 *   - Leaves: keccak256(solidityPack(["address"], [addr]))
 *   - Contract matches with: keccak256(abi.encodePacked(addr))
 *
 * Usage:
 *   source .env.local && npx tsx scripts/generate-merkle-trees.ts
 *
 * Outputs (in project root):
 *   gtd-tree.json / gtd-proofs.json
 *   community-tree.json / community-proofs.json
 *   fcfs-tree.json / fcfs-proofs.json
 *   merkle-roots.json (all 3 roots for contract deployment)
 */

import { SimpleMerkleTree } from '@openzeppelin/merkle-tree'
import { keccak256, solidityPack } from 'ethers/lib/utils'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const OUTPUT_DIR = path.resolve(__dirname, '..')

function generateTreeAndProofs(addresses: string[], label: string) {
  if (addresses.length === 0) {
    console.log(`  ${label}: 0 addresses, skipping tree generation`)
    return null
  }

  const leaves = addresses.map(addr =>
    keccak256(solidityPack(["address"], [addr]))
  )
  const tree = SimpleMerkleTree.of(leaves)

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${label}-tree.json`),
    JSON.stringify(tree.dump(), null, 2)
  )

  const proofs: Record<string, string[]> = {}
  addresses.forEach((addr, index) => {
    proofs[addr.toLowerCase()] = tree.getProof(index)
  })

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${label}-proofs.json`),
    JSON.stringify(proofs, null, 2)
  )

  console.log(`  ${label}: ${addresses.length} addresses, root: ${tree.root}`)
  return tree
}

async function main() {
  console.log('Querying whitelist for phase assignments...\n')

  const { data: gtdWallets, error: e1 } = await supabase
    .from('whitelist')
    .select('wallet_address')
    .eq('gtd', true)
    .eq('status', 'approved')

  const { data: communityWallets, error: e2 } = await supabase
    .from('whitelist')
    .select('wallet_address')
    .eq('community', true)
    .eq('status', 'approved')

  const { data: fcfsWallets, error: e3 } = await supabase
    .from('whitelist')
    .select('wallet_address')
    .eq('fcfs', true)
    .eq('status', 'approved')

  if (e1 || e2 || e3) {
    console.error('DB query failed:', e1 || e2 || e3)
    process.exit(1)
  }

  const gtdAddrs = [...new Set(gtdWallets!.map(w => w.wallet_address.toLowerCase()))]
  const communityAddrs = [...new Set(communityWallets!.map(w => w.wallet_address.toLowerCase()))]
  const fcfsAddrs = [...new Set(fcfsWallets!.map(w => w.wallet_address.toLowerCase()))]

  console.log('Generating merkle trees...')
  const gtdTree = generateTreeAndProofs(gtdAddrs, 'gtd')
  const communityTree = generateTreeAndProofs(communityAddrs, 'community')
  const fcfsTree = generateTreeAndProofs(fcfsAddrs, 'fcfs')

  const roots = {
    gtd: gtdTree?.root || '0x' + '0'.repeat(64),
    community: communityTree?.root || '0x' + '0'.repeat(64),
    fcfs: fcfsTree?.root || '0x' + '0'.repeat(64),
    generated_at: new Date().toISOString(),
    counts: {
      gtd: gtdAddrs.length,
      community: communityAddrs.length,
      fcfs: fcfsAddrs.length,
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'merkle-roots.json'),
    JSON.stringify(roots, null, 2)
  )

  console.log('\nRoots saved to merkle-roots.json')
  console.log(JSON.stringify(roots, null, 2))

  // Verification test
  if (gtdAddrs.length > 0 && gtdTree) {
    const testAddr = gtdAddrs[0]
    const testLeaf = keccak256(solidityPack(["address"], [testAddr]))
    const isValid = gtdTree.verify(0, gtdTree.getProof(0))
    console.log(`\nVerification test (${testAddr}): ${isValid ? 'PASS' : 'FAIL'}`)
  }

  console.log('\nDone. Next: set roots on contract with set-merkle-roots script')
}

main().catch(console.error)
