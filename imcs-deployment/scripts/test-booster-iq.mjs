// Equip booster blasstoyce (2034, 5%) on token1 cloths slot, verify IQ jumps 5%,
// then swap back to original cloths (2029) and verify IQ restores.
import { ethers } from 'ethers'

const API = 'http://127.0.0.1:3100'
const RPC = 'https://sepolia.base.org'
const DEV_PK = '0x6f5dcd5c3b9941aeb6d228a4c378280ba8ec064a205ef0f8917eba4b3628cb35'
const EQUIPMENT = '0x25f1C5A6f6191C83aA666E33007690071FD45720'
const MANAGER = '0x27e6A155A7093153764993955c669c0b0f6e02ab'
const TOKEN_ID = 1
const SLOT = 2
const BOOSTER = 2034 // blasstoyce 5%
const ORIG = 2029 // supa clean shurt

const MGR_ABI = ['function swap(uint256,uint256,uint256,bytes32,bytes,uint256,uint256)']
const EQ_ABI = [
  'function isApprovedForAll(address,address) view returns (bool)',
  'function setApprovalForAll(address,bool)',
  'function balanceOf(address,uint256) view returns (uint256)',
]
const provider = new ethers.JsonRpcProvider(RPC)
const wallet = new ethers.Wallet(DEV_PK, provider)
const addr = wallet.address
const mgr = new ethers.Contract(MANAGER, MGR_ABI, wallet)
const eq = new ethers.Contract(EQUIPMENT, EQ_ABI, wallet)

async function modify(changes) {
  const timestamp = Date.now()
  const lines = changes.map(c => `  Slot ${c.slot}: ${c.newTraitId === 0 ? 'unequip' : `trait ${c.newTraitId}`}`)
  const message = ['Modify Savant Traits', '', `Savant #${TOKEN_ID}`, ...lines, '', `Timestamp: ${timestamp}`, `Wallet: ${addr.toLowerCase()}`].join('\n')
  const signature = await wallet.signMessage(message)
  const res = await fetch(`${API}/api/traits/modify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: addr, tokenId: TOKEN_ID, changes, signature, message, timestamp }) })
  const data = await res.json()
  if (!res.ok) { console.error('modify rejected:', data); process.exit(1) }
  return data
}
async function sync(combo) {
  const res = await fetch(`${API}/api/traits/sync?tokenId=${TOKEN_ID}&expectedCombo=${combo}`, { method: 'POST' })
  const d = await res.json(); if (!res.ok) { console.error('sync failed:', d); process.exit(1) } return d
}
async function iq() {
  const res = await fetch(`${API}/api/metadata/${TOKEN_ID}`); const d = await res.json()
  return { iq: d.attributes.find(a => a.trait_type === 'IQ').value, cloths: d.attributes.find(a => a.trait_type === 'cloths')?.value }
}

console.log('blasstoyce bal:', (await eq.balanceOf(addr, BOOSTER)).toString())
if (!(await eq.isApprovedForAll(addr, MANAGER))) { const t = await eq.setApprovalForAll(MANAGER, true); await t.wait() }
console.log('before:', await iq())

console.log('1) swap cloths -> blasstoyce...')
let op = await modify([{ slot: SLOT, newTraitId: BOOSTER }])
let tx = await mgr.swap(TOKEN_ID, SLOT, BOOSTER, op.newComboHash, op.signature, BigInt(op.deadline), BigInt(op.nonce)); await tx.wait()
await sync(op.newComboHash)
console.log('   after boost:', await iq(), '(expect IQ 734, cloths blasstoyce)')

console.log('2) swap back -> original...')
op = await modify([{ slot: SLOT, newTraitId: ORIG }])
tx = await mgr.swap(TOKEN_ID, SLOT, ORIG, op.newComboHash, op.signature, BigInt(op.deadline), BigInt(op.nonce)); await tx.wait()
await sync(op.newComboHash)
console.log('   restored:', await iq(), '(expect IQ 699)')
console.log('DONE')
