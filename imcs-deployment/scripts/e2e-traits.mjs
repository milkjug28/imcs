// End-to-end test of the cross-chain trait equip flow against a running app + Base Sepolia.
//
// Flow (fully self-restoring): on primary savant + a donor savant the dev wallet owns,
//   1. unequip  primary optional slot          (manager -> user)
//   2. equip    primary slot back              (user -> manager, restores)
//   3. unequip  donor slot   (acquire trait)   (manager -> user)
//   4. swap     primary slot to donor trait    (old -> user, new -> manager)
//   5. swap     primary slot back              (restores primary)
//   6. equip    donor slot back                (restores donor)
//
// Each step: sign personal msg as user -> POST /api/traits/modify -> get EIP-712 sig
//            -> send on-chain tx as user -> assert equipped slot + 1155 balances + combo hash.
//
// Usage:  node scripts/e2e-traits.mjs
//
// Env (reads imcs-deployment/.env):
//   PRIVATE_KEY              dev wallet (owns mainnet savants, funded on Base Sepolia) = test user
//   RPC_URL_BASE_SEPOLIA     Base Sepolia RPC
//   EQUIPMENT_ADDRESS        SavantEquipment (1155)
//   EQUIP_MANAGER_ADDRESS    SavantEquipManager
//   API_URL                  default http://localhost:3000

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonRpcProvider, Wallet, Contract, getAddress } from 'ethers'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const envPath = join(__dirname, '..', '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    if (process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const API_URL = process.env.API_URL || 'http://localhost:3000'
const RPC = process.env.RPC_URL_BASE_SEPOLIA
const EQUIPMENT_ADDRESS = getAddress(process.env.EQUIPMENT_ADDRESS)
const EQUIP_MANAGER_ADDRESS = getAddress(process.env.EQUIP_MANAGER_ADDRESS)

// Test plan: primary savant + slot + donor savant (different trait same layer)
const PRIMARY = Number(process.env.PRIMARY_TOKEN || 1)
const SLOT = Number(process.env.TEST_SLOT || 9) // TEXTUH - rarely linked
const DONOR = Number(process.env.DONOR_TOKEN || 4)

const MANAGER_ABI = [
  'function unequip(uint256 tokenId, uint256 slot, bytes32 newComboHash, bytes signature, uint256 deadline, uint256 nonce) external',
  'function equip(uint256 tokenId, uint256 slot, uint256 traitId, bytes32 newComboHash, bytes signature, uint256 deadline, uint256 nonce) external',
  'function swap(uint256 tokenId, uint256 slot, uint256 newTraitId, bytes32 newComboHash, bytes signature, uint256 deadline, uint256 nonce) external',
  'function getEquipped(uint256 tokenId) view returns (uint256[10])',
  'function tokenToCombo(uint256) view returns (bytes32)',
  'function claimsEnabled() view returns (bool)',
]
const EQUIPMENT_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external',
]

// ── reporting ──
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', x: '\x1b[0m', b: '\x1b[1m' }
let passed = 0, failed = 0
function ok(msg) { passed++; console.log(`  ${C.g}PASS${C.x} ${msg}`) }
function fail(msg) { failed++; console.log(`  ${C.r}FAIL${C.x} ${msg}`) }
function assertEq(label, actual, expected) {
  const a = String(actual), e = String(expected)
  if (a === e) ok(`${label} = ${a}`)
  else fail(`${label}: got ${a}, expected ${e}`)
}
function step(n, title) { console.log(`\n${C.b}── Step ${n}: ${title}${C.x}`) }

// ── api ──
async function callModify(user, tokenId, changes) {
  const timestamp = Date.now()
  const changeLines = changes.map(
    c => `  Slot ${c.slot}: ${c.newTraitId === 0 ? 'unequip' : `trait ${c.newTraitId}`}`
  )
  const message = [
    'Modify Savant Traits', '', `Savant #${tokenId}`,
    ...changeLines, '', `Timestamp: ${timestamp}`, `Wallet: ${user.address.toLowerCase()}`,
  ].join('\n')

  const signature = await user.signMessage(message)

  const res = await fetch(`${API_URL}/api/traits/modify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: user.address, tokenId, changes, signature, message, timestamp }),
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) {
    throw new Error(`/api/traits/modify ${res.status}: ${json.error || text}`)
  }
  console.log(`  ${C.dim}api -> ${json.operation} slot ${json.slot ?? '(batch)'} combo ${json.newComboHash?.slice(0, 12)}…${C.x}`)
  return json
}

async function sendTx(label, txPromise) {
  const tx = await txPromise
  process.stdout.write(`  ${C.dim}${label} -> ${tx.hash.slice(0, 14)}… `)
  const rcpt = await tx.wait()
  console.log(`mined (gas ${rcpt.gasUsed})${C.x}`)
  if (rcpt.status !== 1) throw new Error(`${label} reverted`)
  return rcpt
}

// Alchemy nodes lag on read-after-write; poll until equipped slot reflects expected value.
async function waitForSlot(manager, tokenId, slot, expected, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const v = Number((await manager.getEquipped(tokenId)).map(Number)[slot])
    if (v === expected) return
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`#${tokenId} slot ${slot} did not reach ${expected} (still ${Number((await manager.getEquipped(tokenId)).map(Number)[slot])})`)
}

// Send the on-chain call matching the operation the API signed.
async function dispatch(manager, tokenId, change, api) {
  const d = BigInt(api.deadline), n = BigInt(api.nonce)
  if (api.operation === 'unequip')
    return sendTx('unequip', manager.unequip(tokenId, change.slot, api.newComboHash, api.signature, d, n))
  if (api.operation === 'equip')
    return sendTx('equip', manager.equip(tokenId, change.slot, api.traitId, api.newComboHash, api.signature, d, n))
  if (api.operation === 'swap')
    return sendTx('swap', manager.swap(tokenId, change.slot, api.newTraitId, api.newComboHash, api.signature, d, n))
  throw new Error(`unexpected operation ${api.operation}`)
}

// canonical (seeded) traits, so we know the intended baseline even if a prior run left state dirty
function canonicalTrait(token, slot) {
  const tt = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'token-traits.json'), 'utf8'))
  return tt[String(token)][slot]
}

let _manager, _equipment, _user
async function curSlot(token) { return (await _manager.getEquipped(token)).map(Number)[SLOT] }
async function bal(id) { return Number(await _equipment.balanceOf(_user.address, id)) }

// POST modify, assert the operation type, send the matching on-chain tx, wait for propagation.
async function doStep(token, newTraitId, expectedOp) {
  const change = { slot: SLOT, newTraitId }
  const api = await callModify(_user, token, [change])
  assertEq('operation', api.operation, expectedOp)
  await dispatch(_manager, token, change, api)
  await waitForSlot(_manager, token, SLOT, newTraitId)
  return api
}

// Bring a token's test slot back to its canonical trait (recovers from a prior dirty run).
async function normalize(token, canonical) {
  const cur = await curSlot(token)
  if (cur === canonical) return
  console.log(`  ${C.y}normalizing #${token} slot ${SLOT}: ${cur} -> ${canonical}${C.x}`)
  if (cur === 0) await doStep(token, canonical, 'equip')
  else await doStep(token, canonical, 'swap')
}

async function main() {
  if (!RPC) throw new Error('RPC_URL_BASE_SEPOLIA unset')
  const provider = new JsonRpcProvider(RPC)
  _user = new Wallet(process.env.PRIVATE_KEY, provider)
  _manager = new Contract(EQUIP_MANAGER_ADDRESS, MANAGER_ABI, _user)
  _equipment = new Contract(EQUIPMENT_ADDRESS, EQUIPMENT_ABI, _user)
  const user = _user, manager = _manager, equipment = _equipment

  const net = await provider.getNetwork()
  console.log(`${C.b}E2E trait flow${C.x}`)
  console.log(`  user (test wallet) : ${user.address}`)
  console.log(`  chainId            : ${net.chainId}`)
  console.log(`  manager            : ${EQUIP_MANAGER_ADDRESS}`)
  console.log(`  equipment          : ${EQUIPMENT_ADDRESS}`)
  console.log(`  api                : ${API_URL}`)
  console.log(`  primary #${PRIMARY} slot ${SLOT}, donor #${DONOR}`)

  if (!(await manager.claimsEnabled())) throw new Error('claimsEnabled is false on manager')
  console.log(`  user gas balance   : ${await provider.getBalance(user.address)} wei`)

  const primaryTrait = canonicalTrait(PRIMARY, SLOT)
  const donorTrait = canonicalTrait(DONOR, SLOT)
  if (!primaryTrait) throw new Error(`primary #${PRIMARY} slot ${SLOT} canonical trait is 0`)
  if (!donorTrait) throw new Error(`donor #${DONOR} slot ${SLOT} canonical trait is 0`)
  if (donorTrait === primaryTrait) throw new Error(`donor trait equals primary trait (${donorTrait})`)
  console.log(`  primary trait ${primaryTrait}, donor trait ${donorTrait}`)

  // operator approval (equip/swap pull 1155 from user)
  if (!(await equipment.isApprovedForAll(user.address, EQUIP_MANAGER_ADDRESS))) {
    await sendTx('setApprovalForAll', equipment.setApprovalForAll(EQUIP_MANAGER_ADDRESS, true))
  }

  // recover from any prior dirty run, then snapshot true baseline
  await normalize(PRIMARY, primaryTrait)
  await normalize(DONOR, donorTrait)
  const combo0 = await manager.tokenToCombo(PRIMARY)
  const combo0d = await manager.tokenToCombo(DONOR)
  const balP0 = await bal(primaryTrait)
  const balD0 = await bal(donorTrait)
  console.log(`  baseline: combo ${combo0.slice(0, 12)}…, balances p=${balP0} d=${balD0}`)

  // ── Step 1: unequip primary (manager -> user) ──
  step(1, `unequip #${PRIMARY} slot ${SLOT} (trait ${primaryTrait})`)
  let api = await doStep(PRIMARY, 0, 'unequip')
  assertEq('traitId', api.traitId, primaryTrait)
  assertEq('user balance(primaryTrait) +1', await bal(primaryTrait), balP0 + 1)
  assertEq('tokenToCombo', await manager.tokenToCombo(PRIMARY), api.newComboHash)

  // ── Step 2: equip primary back (user -> manager) ──
  step(2, `equip #${PRIMARY} slot ${SLOT} back (trait ${primaryTrait})`)
  api = await doStep(PRIMARY, primaryTrait, 'equip')
  assertEq('newComboHash == original', api.newComboHash, combo0)
  assertEq('user balance(primaryTrait) baseline', await bal(primaryTrait), balP0)
  assertEq('tokenToCombo restored', await manager.tokenToCombo(PRIMARY), combo0)

  // ── Step 3: acquire donor trait by unequipping donor ──
  step(3, `unequip donor #${DONOR} slot ${SLOT} (trait ${donorTrait}) to acquire it`)
  await doStep(DONOR, 0, 'unequip')
  assertEq('user balance(donorTrait) +1', await bal(donorTrait), balD0 + 1)

  // ── Step 4: swap primary slot to donor trait ──
  step(4, `swap #${PRIMARY} slot ${SLOT}: ${primaryTrait} -> ${donorTrait}`)
  api = await doStep(PRIMARY, donorTrait, 'swap')
  assertEq('oldTraitId', api.oldTraitId, primaryTrait)
  assertEq('newTraitId', api.newTraitId, donorTrait)
  assertEq('user balance(primaryTrait) +1', await bal(primaryTrait), balP0 + 1)
  assertEq('user balance(donorTrait) back', await bal(donorTrait), balD0)
  assertEq('tokenToCombo', await manager.tokenToCombo(PRIMARY), api.newComboHash)

  // ── Step 5: swap primary back to original (restore) ──
  step(5, `swap #${PRIMARY} slot ${SLOT} back: ${donorTrait} -> ${primaryTrait}`)
  api = await doStep(PRIMARY, primaryTrait, 'swap')
  assertEq('newComboHash == original', api.newComboHash, combo0)
  assertEq('tokenToCombo restored', await manager.tokenToCombo(PRIMARY), combo0)

  // ── Step 6: equip donor trait back (restore donor) ──
  step(6, `equip donor #${DONOR} slot ${SLOT} back (trait ${donorTrait})`)
  api = await doStep(DONOR, donorTrait, 'equip')
  assertEq('newComboHash == donor original', api.newComboHash, combo0d)
  assertEq('donor tokenToCombo restored', await manager.tokenToCombo(DONOR), combo0d)

  // ── final baseline check ──
  step('final', 'state fully restored')
  assertEq('primary balance baseline', await bal(primaryTrait), balP0)
  assertEq('donor balance baseline', await bal(donorTrait), balD0)

  console.log(`\n${C.b}Result:${C.x} ${C.g}${passed} passed${C.x}, ${failed ? C.r : ''}${failed} failed${C.x}`)
  process.exit(failed ? 1 : 0)
}

main().catch(async (e) => {
  console.log(`\n${C.r}${C.b}ERROR:${C.x} ${e.message}`)
  // best-effort state dump for manual recovery
  try {
    const provider = new JsonRpcProvider(RPC)
    const manager = new Contract(EQUIP_MANAGER_ADDRESS, MANAGER_ABI, provider)
    console.log(`${C.y}current #${PRIMARY} equipped:${C.x}`, (await manager.getEquipped(PRIMARY)).map(Number))
    console.log(`${C.y}current #${DONOR} equipped:${C.x}`, (await manager.getEquipped(DONOR)).map(Number))
  } catch {}
  console.log(`\n${C.b}Result:${C.x} ${C.g}${passed} passed${C.x}, ${C.r}${failed} failed${C.x} (aborted)`)
  process.exit(1)
})
