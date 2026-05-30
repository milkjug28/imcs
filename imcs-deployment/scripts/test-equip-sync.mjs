// Proves equip -> on-chain -> sync -> metadata/image reflect loop.
// Unequips token1 hatss (slot 7), syncs, verifies, then re-equips to restore.
import { ethers } from 'ethers'

const API = 'http://localhost:3100'
const RPC = 'https://sepolia.base.org'
const DEV_PK = '0x6f5dcd5c3b9941aeb6d228a4c378280ba8ec064a205ef0f8917eba4b3628cb35'
const EQUIPMENT = '0x25f1C5A6f6191C83aA666E33007690071FD45720'
const MANAGER = '0x27e6A155A7093153764993955c669c0b0f6e02ab'
const TOKEN_ID = 1
const SLOT = 7
const TRAIT = 7006 // dad burd

const MGR_ABI = [
  'function unequip(uint256 tokenId,uint256 slot,bytes32 newComboHash,bytes signature,uint256 deadline,uint256 nonce)',
  'function equip(uint256 tokenId,uint256 slot,uint256 traitId,bytes32 newComboHash,bytes signature,uint256 deadline,uint256 nonce)',
]
const EQ_ABI = [
  'function isApprovedForAll(address account,address operator) view returns (bool)',
  'function setApprovalForAll(address operator,bool approved)',
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
  const q = expectedCombo ? `&expectedCombo=${expectedCombo}` : ''
  const res = await fetch(`${API}/api/traits/sync?tokenId=${TOKEN_ID}${q}`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) { console.error('sync failed:', data); process.exit(1) }
  return data
}

async function metaAttrs() {
  const res = await fetch(`${API}/api/metadata/${TOKEN_ID}`)
  const data = await res.json()
  return data.attributes.filter(a => a.trait_type !== 'IQ').map(a => a.trait_type)
}

// --- 1. UNEQUIP slot 7 ---
console.log('1) unequip slot 7 (hatss)...')
let op = await modify([{ slot: SLOT, newTraitId: 0 }])
if (op.operation !== 'unequip') { console.error('expected unequip, got', op.operation); process.exit(1) }
let tx = await mgr.unequip(TOKEN_ID, SLOT, op.newComboHash, op.signature, BigInt(op.deadline), BigInt(op.nonce))
await tx.wait()
console.log('   unequipped. tx', tx.hash)

const s1 = await sync(op.newComboHash)
const a1 = await metaAttrs()
console.log('   after-unequip image:', s1.image)
console.log('   after-unequip trait_types:', a1.join(','))
console.log('   hatss present?', a1.includes('hatss'))

// --- 2. RE-EQUIP slot 7 ---
console.log('2) re-equip slot 7 trait 7006...')
const approved = await eq.isApprovedForAll(addr, MANAGER)
if (!approved) { const atx = await eq.setApprovalForAll(MANAGER, true); await atx.wait(); console.log('   approved') }
op = await modify([{ slot: SLOT, newTraitId: TRAIT }])
if (op.operation !== 'equip') { console.error('expected equip, got', op.operation); process.exit(1) }
tx = await mgr.equip(TOKEN_ID, SLOT, TRAIT, op.newComboHash, op.signature, BigInt(op.deadline), BigInt(op.nonce))
await tx.wait()
console.log('   re-equipped. tx', tx.hash)

const s2 = await sync(op.newComboHash)
const a2 = await metaAttrs()
console.log('   after-restore image:', s2.image)
console.log('   after-restore trait_types:', a2.join(','))
console.log('   hatss restored?', a2.includes('hatss'))
console.log('DONE')
