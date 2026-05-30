// Equip-swap a NEW trait (doge hat 7040) onto token1 slot7, sync, verify
// metadata + composite reflect it, then swap back to original 7006 to restore.
import { ethers } from 'ethers'

const API = 'http://127.0.0.1:3100'
const RPC = 'https://sepolia.base.org'
const DEV_PK = '0x6f5dcd5c3b9941aeb6d228a4c378280ba8ec064a205ef0f8917eba4b3628cb35'
const EQUIPMENT = '0x25f1C5A6f6191C83aA666E33007690071FD45720'
const MANAGER = '0x27e6A155A7093153764993955c669c0b0f6e02ab'
const TOKEN_ID = 1
const SLOT = 7
const NEW_TRAIT = 7040 // doge (new hatss)
const ORIG_TRAIT = 7006 // dad burd (token1 original hatss)

const MGR_ABI = [
  'function swap(uint256 tokenId,uint256 slot,uint256 newTraitId,bytes32 newComboHash,bytes signature,uint256 deadline,uint256 nonce)',
]
const EQ_ABI = [
  'function isApprovedForAll(address account,address operator) view returns (bool)',
  'function setApprovalForAll(address operator,bool approved)',
  'function balanceOf(address account,uint256 id) view returns (uint256)',
]

const provider = new ethers.JsonRpcProvider(RPC)
const wallet = new ethers.Wallet(DEV_PK, provider)
const addr = wallet.address
const mgr = new ethers.Contract(MANAGER, MGR_ABI, wallet)
const eq = new ethers.Contract(EQUIPMENT, EQ_ABI, wallet)

async function modify(changes) {
  const timestamp = Date.now()
  const changeLines = changes.map(c => `  Slot ${c.slot}: ${c.newTraitId === 0 ? 'unequip' : `trait ${c.newTraitId}`}`)
  const message = ['Modify Savant Traits', '', `Savant #${TOKEN_ID}`, ...changeLines, '', `Timestamp: ${timestamp}`, `Wallet: ${addr.toLowerCase()}`].join('\n')
  const signature = await wallet.signMessage(message)
  const res = await fetch(`${API}/api/traits/modify`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: addr, tokenId: TOKEN_ID, changes, signature, message, timestamp }),
  })
  const data = await res.json()
  if (!res.ok) { console.error('modify rejected:', data); process.exit(1) }
  return data
}

async function sync(expectedCombo) {
  const res = await fetch(`${API}/api/traits/sync?tokenId=${TOKEN_ID}&expectedCombo=${expectedCombo}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) { console.error('sync failed:', data); process.exit(1) }
  return data
}

async function metaAttrs() {
  const res = await fetch(`${API}/api/metadata/${TOKEN_ID}`)
  const data = await res.json()
  return data.attributes.filter(a => a.trait_type !== 'IQ')
}

console.log('dev doge(7040) balance:', (await eq.balanceOf(addr, NEW_TRAIT)).toString())
const approved = await eq.isApprovedForAll(addr, MANAGER)
if (!approved) { const atx = await eq.setApprovalForAll(MANAGER, true); await atx.wait(); console.log('approved') }

// --- 1. SWAP slot7 -> new doge ---
console.log('1) swap slot7 -> doge (7040)...')
let op = await modify([{ slot: SLOT, newTraitId: NEW_TRAIT }])
if (op.operation !== 'swap') { console.error('expected swap, got', op.operation); process.exit(1) }
let tx = await mgr.swap(TOKEN_ID, SLOT, NEW_TRAIT, op.newComboHash, op.signature, BigInt(op.deadline), BigInt(op.nonce))
await tx.wait()
console.log('   swapped. tx', tx.hash)
let s = await sync(op.newComboHash)
let a = await metaAttrs()
const hatss1 = a.find(x => x.trait_type === 'hatss')
console.log('   image:', s.image)
console.log('   hatss value:', hatss1?.value, '(expect doge)')

// --- 2. SWAP back -> original ---
console.log('2) swap slot7 back -> 7006...')
op = await modify([{ slot: SLOT, newTraitId: ORIG_TRAIT }])
tx = await mgr.swap(TOKEN_ID, SLOT, ORIG_TRAIT, op.newComboHash, op.signature, BigInt(op.deadline), BigInt(op.nonce))
await tx.wait()
console.log('   restored. tx', tx.hash)
s = await sync(op.newComboHash)
a = await metaAttrs()
const hatss2 = a.find(x => x.trait_type === 'hatss')
console.log('   image:', s.image)
console.log('   hatss value:', hatss2?.value, '(expect dad burd / original)')
console.log('DONE')
