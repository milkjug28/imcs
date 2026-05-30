import { ethers } from 'ethers'

const API = 'http://localhost:3100'
const DEV_PK = '0x6f5dcd5c3b9941aeb6d228a4c378280ba8ec064a205ef0f8917eba4b3628cb35'
const MANAGER = '0x27e6A155A7093153764993955c669c0b0f6e02ab'
const EQUIPMENT = '0x25f1C5A6f6191C83aA666E33007690071FD45720'

const p = new ethers.JsonRpcProvider('https://sepolia.base.org')
const w = new ethers.Wallet(DEV_PK, p)
const mgr = new ethers.Contract(MANAGER, ['function equip(uint256,uint256,uint256,bytes32,bytes,uint256,uint256)'], w)
const eq = new ethers.Contract(EQUIPMENT, ['function isApprovedForAll(address,address) view returns (bool)', 'function setApprovalForAll(address,bool)'], w)

const ts = Date.now()
const msg = ['Modify Savant Traits', '', 'Savant #1', '  Slot 7: trait 7006', '', `Timestamp: ${ts}`, `Wallet: ${w.address.toLowerCase()}`].join('\n')
const sig = await w.signMessage(msg)
const res = await fetch(API + '/api/traits/modify', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ wallet: w.address, tokenId: 1, changes: [{ slot: 7, newTraitId: 7006 }], signature: sig, message: msg, timestamp: ts }),
})
const d = await res.json()
if (!res.ok) { console.error('modify rejected', d); process.exit(1) }
console.log('op:', d.operation)
if (d.operation !== 'equip') { console.error('expected equip got', d.operation); process.exit(1) }
const ok = await eq.isApprovedForAll(w.address, MANAGER)
if (!ok) { const a = await eq.setApprovalForAll(MANAGER, true); await a.wait() }
const tx = await mgr.equip(1, 7, 7006, d.newComboHash, d.signature, BigInt(d.deadline), BigInt(d.nonce))
await tx.wait()
console.log('restored hat. tx', tx.hash)
