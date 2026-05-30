// Edge-case / negative-path tests for the trait equip system on Base Sepolia.
// Complements e2e-traits.mjs (happy path). Covers the guards that flow didn't touch:
//   1. batchModify    - multi-slot change in one tx (+ restore)
//   2. autoChanges    - full-face AYEZZ auto-unequips MOUFS (API-only, no on-chain)
//   3. required-slot  - API rejects unequip of slot 0; contract reverts "Required slot"
//   4. replay         - reusing a consumed signature reverts "Signature used"
//   5. deadline       - expired deadline reverts "Expired"
//   6. collision      - reusing another token's combo hash reverts "Combo taken"
//
// Usage:
//   API_URL=http://localhost:3100 \
//   EQUIPMENT_ADDRESS=0x.. EQUIP_MANAGER_ADDRESS=0x.. \
//   node scripts/e2e-traits-edge.mjs
//
// Reads imcs-deployment/.env (PRIVATE_KEY = test user/dev wallet) and the monorepo
// root ../../.env (SIGNER_PRIVATE_KEY = authorizedSigner, for crafting raw sigs).

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonRpcProvider, Wallet, Contract, getAddress } from 'ethers'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(p) {
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnvFile(join(__dirname, '..', '.env'))
loadEnvFile(join(__dirname, '..', '..', '.env')) // monorepo root: SIGNER_PRIVATE_KEY

const API_URL = process.env.API_URL || 'http://localhost:3100'
const RPC = process.env.RPC_URL_BASE_SEPOLIA
const EQUIPMENT_ADDRESS = getAddress(process.env.EQUIPMENT_ADDRESS)
const EQUIP_MANAGER_ADDRESS = getAddress(process.env.EQUIP_MANAGER_ADDRESS)
const SIGNER_PK = process.env.SIGNER_PRIVATE_KEY

const PRIMARY = Number(process.env.PRIMARY_TOKEN || 1)
const DONOR = Number(process.env.DONOR_TOKEN || 4)
const FULL_FACE_AYEZZ = Number(process.env.FULL_FACE_AYEZZ || 4001)

const MANAGER_ABI = [
  'function unequip(uint256 tokenId, uint256 slot, bytes32 newComboHash, bytes signature, uint256 deadline, uint256 nonce) external',
  'function equip(uint256 tokenId, uint256 slot, uint256 traitId, bytes32 newComboHash, bytes signature, uint256 deadline, uint256 nonce) external',
  'function swap(uint256 tokenId, uint256 slot, uint256 newTraitId, bytes32 newComboHash, bytes signature, uint256 deadline, uint256 nonce) external',
  'function batchModify(uint256 tokenId, uint256[] slots, uint256[] newTraitIds, bytes32 newComboHash, bytes signature, uint256 deadline, uint256 nonce) external',
  'function getEquipped(uint256 tokenId) view returns (uint256[10])',
  'function tokenToCombo(uint256) view returns (bytes32)',
]
const EQUIPMENT_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external',
]

const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', x: '\x1b[0m', b: '\x1b[1m' }
let passed = 0, failed = 0
function ok(m) { passed++; console.log(`  ${C.g}PASS${C.x} ${m}`) }
function bad(m) { failed++; console.log(`  ${C.r}FAIL${C.x} ${m}`) }
function assertEq(label, a, e) { String(a) === String(e) ? ok(`${label} = ${a}`) : bad(`${label}: got ${a}, expected ${e}`) }
function test(n, t) { console.log(`\n${C.b}── Test ${n}: ${t}${C.x}`) }

// expect a promise to revert; pass if the revert reason contains `needle`
async function expectRevert(label, promise, needle) {
  try {
    const tx = await promise
    await tx.wait()
    bad(`${label}: expected revert "${needle}" but tx succeeded`)
  } catch (e) {
    const msg = e.reason || e.shortMessage || e.message || ''
    if (msg.includes(needle)) ok(`${label}: reverted "${needle}"`)
    else bad(`${label}: reverted but with "${msg.slice(0, 80)}" (wanted "${needle}")`)
  }
}

let _provider, _user, _signer, _manager, _equipment
async function curSlot(token, slot) { return Number((await _manager.getEquipped(token)).map(Number)[slot]) }
async function waitForSlot(token, slot, expected, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if ((await curSlot(token, slot)) === expected) return
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`#${token} slot ${slot} never reached ${expected}`)
}

async function callModify(token, changes) {
  const timestamp = Date.now()
  const changeLines = changes.map(c => `  Slot ${c.slot}: ${c.newTraitId === 0 ? 'unequip' : `trait ${c.newTraitId}`}`)
  const message = ['Modify Savant Traits', '', `Savant #${token}`, ...changeLines, '', `Timestamp: ${timestamp}`, `Wallet: ${_user.address.toLowerCase()}`].join('\n')
  const signature = await _user.signMessage(message)
  const res = await fetch(`${API_URL}/api/traits/modify`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: _user.address, tokenId: token, changes, signature, message, timestamp }),
  })
  const text = await res.text()
  let json; try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: res.status, json }
}

async function sendTx(label, p) {
  const tx = await p
  process.stdout.write(`  ${C.dim}${label} -> ${tx.hash.slice(0, 14)}… `)
  const rcpt = await tx.wait()
  console.log(`mined${C.x}`)
  if (rcpt.status !== 1) throw new Error(`${label} reverted`)
  return rcpt
}

// raw EIP-712 sign with the authorized signer key (domain must match contract)
function domain() {
  return { name: 'SavantEquipManager', version: '1', chainId: 84532, verifyingContract: EQUIP_MANAGER_ADDRESS }
}
async function signUnequipRaw(tokenId, slot, newComboHash, caller, deadline, nonce) {
  return _signer.signTypedData(domain(), {
    Unequip: [
      { name: 'tokenId', type: 'uint256' }, { name: 'slot', type: 'uint256' },
      { name: 'newComboHash', type: 'bytes32' }, { name: 'caller', type: 'address' },
      { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
    ],
  }, { tokenId, slot, newComboHash, caller, deadline, nonce })
}

async function main() {
  if (!RPC) throw new Error('RPC_URL_BASE_SEPOLIA unset')
  if (!SIGNER_PK) throw new Error('SIGNER_PRIVATE_KEY unset (monorepo root .env)')
  _provider = new JsonRpcProvider(RPC)
  _user = new Wallet(process.env.PRIVATE_KEY, _provider)
  _signer = new Wallet(SIGNER_PK, _provider)
  _manager = new Contract(EQUIP_MANAGER_ADDRESS, MANAGER_ABI, _user)
  _equipment = new Contract(EQUIPMENT_ADDRESS, EQUIPMENT_ABI, _user)

  console.log(`${C.b}Edge-case trait tests${C.x}`)
  console.log(`  user ${_user.address}  signer ${_signer.address}`)
  console.log(`  manager ${EQUIP_MANAGER_ADDRESS}  api ${API_URL}`)

  if (!(await _equipment.isApprovedForAll(_user.address, EQUIP_MANAGER_ADDRESS)))
    await sendTx('setApprovalForAll', _equipment.setApprovalForAll(EQUIP_MANAGER_ADDRESS, true))

  // canonical traits for restore safety
  const tt = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'token-traits.json'), 'utf8'))
  const t7 = tt[String(PRIMARY)][7], t9 = tt[String(PRIMARY)][9]
  const combo0 = await _manager.tokenToCombo(PRIMARY)

  // ── Test 1: batchModify (unequip slots 7 + 9 in one tx, then restore) ──
  test(1, `batchModify: unequip slots 7 (${t7}) + 9 (${t9}) in one tx`)
  {
    const r = await callModify(PRIMARY, [{ slot: 7, newTraitId: 0 }, { slot: 9, newTraitId: 0 }])
    if (r.status !== 200) { bad(`batch unequip API ${r.status}: ${r.json.error}`) }
    else {
      assertEq('operation', r.json.operation, 'batchModify')
      const d = BigInt(r.json.deadline), n = BigInt(r.json.nonce)
      await sendTx('batchModify', _manager.batchModify(PRIMARY, r.json.slots, r.json.newTraitIds, r.json.newComboHash, r.json.signature, d, n))
      await waitForSlot(PRIMARY, 7, 0); await waitForSlot(PRIMARY, 9, 0)
      assertEq('slot 7 empty', await curSlot(PRIMARY, 7), 0)
      assertEq('slot 9 empty', await curSlot(PRIMARY, 9), 0)
      assertEq('user holds trait7', Number(await _equipment.balanceOf(_user.address, t7)), 1)
      assertEq('user holds trait9', Number(await _equipment.balanceOf(_user.address, t9)), 1)
      // restore via batchModify
      const r2 = await callModify(PRIMARY, [{ slot: 7, newTraitId: t7 }, { slot: 9, newTraitId: t9 }])
      assertEq('restore operation', r2.json.operation, 'batchModify')
      await sendTx('batchModify restore', _manager.batchModify(PRIMARY, r2.json.slots, r2.json.newTraitIds, r2.json.newComboHash, r2.json.signature, BigInt(r2.json.deadline), BigInt(r2.json.nonce)))
      await waitForSlot(PRIMARY, 7, t7); await waitForSlot(PRIMARY, 9, t9)
      assertEq('combo restored', await _manager.tokenToCombo(PRIMARY), combo0)
    }
  }

  // ── Test 2: autoChanges (full-face AYEZZ auto-unequips MOUFS) — API only ──
  test(2, `autoChanges: equip full-face ayezz ${FULL_FACE_AYEZZ} auto-unequips moufs`)
  {
    const r = await callModify(PRIMARY, [{ slot: 4, newTraitId: FULL_FACE_AYEZZ }])
    if (r.status !== 200) { bad(`API ${r.status}: ${r.json.error}`) }
    else {
      assertEq('operation', r.json.operation, 'batchModify')
      const auto = (r.json.autoChanges || []).find(c => c.slot === 5)
      auto && auto.newTraitId === 0 ? ok('autoChanges unequips moufs (slot 5 -> 0)') : bad(`autoChanges missing moufs unequip: ${JSON.stringify(r.json.autoChanges)}`)
    }
  }

  // ── Test 3a: required-slot rejected by API ──
  test('3a', 'API rejects unequip of required slot 0 (BGS)')
  {
    const r = await callModify(PRIMARY, [{ slot: 0, newTraitId: 0 }])
    r.status === 400 ? ok(`API 400: "${r.json.error}"`) : bad(`expected 400, got ${r.status}`)
  }

  // ── Test 3b: required-slot reverts on contract (guard before sig check) ──
  test('3b', 'contract reverts unequip of required slot 0')
  {
    const future = BigInt(Math.floor(Date.now() / 1000) + 600)
    await expectRevert('unequip slot0', _manager.unequip(PRIMARY, 0, combo0, '0x00', future, 999001n), 'Required slot')
  }

  // ── Test 4: deadline expiry (guard before sig check) ──
  test(4, 'contract reverts expired deadline')
  {
    const past = BigInt(Math.floor(Date.now() / 1000) - 60)
    await expectRevert('unequip expired', _manager.unequip(PRIMARY, 9, combo0, '0x00', past, 999002n), 'Expired')
  }

  // ── Test 5: combo collision (reuse donor's combo hash) ──
  test(5, `collision: unequip #${PRIMARY} slot 9 with #${DONOR}'s combo hash`)
  {
    const comboDonor = await _manager.tokenToCombo(DONOR)
    const future = BigInt(Math.floor(Date.now() / 1000) + 600)
    const nonce = BigInt(Date.now())
    const sig = await signUnequipRaw(BigInt(PRIMARY), 9n, comboDonor, _user.address, future, nonce)
    await expectRevert('collision unequip', _manager.unequip(PRIMARY, 9, comboDonor, sig, future, nonce), 'Combo taken')
  }

  // ── Test 6: signature replay ──
  test(6, 'replay: reuse a consumed unequip signature')
  {
    const r = await callModify(PRIMARY, [{ slot: 9, newTraitId: 0 }])
    if (r.status !== 200 || r.json.operation !== 'unequip') { bad(`setup unequip API: ${r.status} ${r.json.error || r.json.operation}`) }
    else {
      const d = BigInt(r.json.deadline), n = BigInt(r.json.nonce)
      await sendTx('unequip (first use)', _manager.unequip(PRIMARY, 9, r.json.newComboHash, r.json.signature, d, n))
      await waitForSlot(PRIMARY, 9, 0)
      ok('first use mined')
      // reuse identical params -> digest already consumed
      await expectRevert('replay', _manager.unequip(PRIMARY, 9, r.json.newComboHash, r.json.signature, d, n), 'Signature used')
      // restore slot 9
      const r2 = await callModify(PRIMARY, [{ slot: 9, newTraitId: t9 }])
      await sendTx('equip restore', _manager.equip(PRIMARY, 9, t9, r2.json.newComboHash, r2.json.signature, BigInt(r2.json.deadline), BigInt(r2.json.nonce)))
      await waitForSlot(PRIMARY, 9, t9)
      assertEq('combo restored', await _manager.tokenToCombo(PRIMARY), combo0)
    }
  }

  console.log(`\n${C.b}Result:${C.x} ${C.g}${passed} passed${C.x}, ${failed ? C.r : ''}${failed} failed${C.x}`)
  process.exit(failed ? 1 : 0)
}

main().catch(async (e) => {
  console.log(`\n${C.r}${C.b}ERROR:${C.x} ${e.message}`)
  try {
    const m = new Contract(EQUIP_MANAGER_ADDRESS, MANAGER_ABI, new JsonRpcProvider(RPC))
    console.log(`${C.y}#${PRIMARY} equipped:${C.x}`, (await m.getEquipped(PRIMARY)).map(Number))
  } catch {}
  console.log(`\n${C.b}Result:${C.x} ${C.g}${passed} passed${C.x}, ${C.r}${failed} failed${C.x} (aborted)`)
  process.exit(1)
})
