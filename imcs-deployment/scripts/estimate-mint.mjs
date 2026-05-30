import { ethers } from 'ethers'
import { readFileSync } from 'fs'

const s = JSON.parse(readFileSync(new URL('../data/trait-supply.json', import.meta.url)))
const mb = s.mintBatch
const ids = mb.traitIds, amts = mb.amounts
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org')
const EQUIP = '0x25f1C5A6f6191C83aA666E33007690071FD45720'
const OWNER = '0x72c9A31e14E73fDe12090301Ba58D139Ba381fCc'
const abi = ['function mintBatch(address to, uint256[] ids, uint256[] amounts)']
const c = new ethers.Contract(EQUIP, abi, provider)
const fresh = '0x000000000000000000000000000000000000dEaD'

try {
  const g = await c.mintBatch.estimateGas(fresh, ids, amts, { from: OWNER })
  console.log('FULL batch (' + ids.length + ' ids) gas:', g.toString())
} catch (e) { console.log('full batch err:', e.shortMessage || e.message) }

try {
  const g2 = await c.mintBatch.estimateGas(fresh, ids.slice(0, 40), amts.slice(0, 40), { from: OWNER })
  console.log('40-id batch gas:', g2.toString(), '=> per-id ~', Math.round(Number(g2) / 40))
} catch (e) { console.log('40 err:', e.shortMessage || e.message) }
