import { ethers } from 'ethers'

const API = 'http://localhost:3100'
const RPC = 'https://sepolia.base.org'
const DEV_PK = '0x6f5dcd5c3b9941aeb6d228a4c378280ba8ec064a205ef0f8917eba4b3628cb35'
const EQUIPMENT = '0x25f1C5A6f6191C83aA666E33007690071FD45720'
const MANAGER = '0x27e6A155A7093153764993955c669c0b0f6e02ab'
const TOKEN_ID = 1
const SLOT = 2
const TRAIT = 2029

const MGR_ABI = ['function equip(uint256 tokenId,uint256 slot,uint256 traitId,bytes32 newComboHash,bytes signature,uint256 deadline,uint256 nonce)']
const EQ_ABI = [
  'function isApprovedForAll(address account,address operator) view returns (bool)',
  'function setApprovalForAll(address operator,bool approved)',
]

const provider = new ethers.JsonRpcProvider(RPC)
const wallet = new ethers.Wallet(DEV_PK, provider)
const addr = wallet.address

const timestamp = Date.now()
const changes = [{ slot: SLOT, newTraitId: TRAIT }]
const changeLines = changes.map(c => `  Slot ${c.slot}: ${c.newTraitId === 0 ? 'unequip' : `trait ${c.newTraitId}`}`)
const message = ['Modify Savant Traits', '', `Savant #${TOKEN_ID}`, ...changeLines, '', `Timestamp: ${timestamp}`, `Wallet: ${addr.toLowerCase()}`].join('\n')

const signature = await wallet.signMessage(message)

const res = await fetch(`${API}/api/traits/modify`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ wallet: addr, tokenId: TOKEN_ID, changes, signature, message, timestamp }),
})
const data = await res.json()
if (!res.ok) { console.error('modify rejected:', data); process.exit(1) }
console.log('api operation:', data.operation, 'newComboHash:', data.newComboHash)
if (data.operation !== 'equip') { console.error('expected equip, got', data.operation); process.exit(1) }

const eq = new ethers.Contract(EQUIPMENT, EQ_ABI, wallet)
const approved = await eq.isApprovedForAll(addr, MANAGER)
if (!approved) {
  console.log('setApprovalForAll...')
  const atx = await eq.setApprovalForAll(MANAGER, true)
  await atx.wait()
  console.log('approved')
}

const mgr = new ethers.Contract(MANAGER, MGR_ABI, wallet)
const tx = await mgr.equip(TOKEN_ID, SLOT, TRAIT, data.newComboHash, data.signature, BigInt(data.deadline), BigInt(data.nonce))
console.log('equip tx:', tx.hash)
await tx.wait()
console.log('mined. token1 slot2 should now =', TRAIT)
