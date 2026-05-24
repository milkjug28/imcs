import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage, isAddress } from 'viem'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { verifyOwnership } from '@/lib/eth-ownership'
import { getEquipped, isComboTaken } from '@/lib/base-client'
import { validateTraitChange, computeComboHash, type SlotChange } from '@/lib/trait-validation'
import { signEquip, signUnequip, signSwap, signBatchModify } from '@/lib/trait-signer'

export const dynamic = 'force-dynamic'

type RequestBody = {
  wallet: string
  tokenId: number
  changes: SlotChange[]
  signature: string
  message: string
  timestamp: number
}

export async function POST(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`trait-modify:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { wallet, tokenId, changes, signature, message } = body

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 4269) {
    return NextResponse.json({ error: 'invalid token id' }, { status: 400 })
  }
  if (!changes?.length) {
    return NextResponse.json({ error: 'no changes provided' }, { status: 400 })
  }
  if (!signature || !message) {
    return NextResponse.json({ error: 'signature required' }, { status: 400 })
  }

  const timestamp = body.timestamp
  if (!timestamp || typeof timestamp !== 'number') {
    return NextResponse.json({ error: 'timestamp required' }, { status: 400 })
  }
  const age = Date.now() - timestamp
  if (age < 0 || age > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'signature expired' }, { status: 400 })
  }

  const changeLines = changes.map(
    (c: SlotChange) => `  Slot ${c.slot}: ${c.newTraitId === 0 ? 'unequip' : `trait ${c.newTraitId}`}`
  )
  const expectedMessage = [
    'Modify Savant Traits',
    '',
    `Savant #${tokenId}`,
    ...changeLines,
    '',
    `Timestamp: ${timestamp}`,
    `Wallet: ${wallet.toLowerCase()}`,
  ].join('\n')

  if (message !== expectedMessage) {
    return NextResponse.json({ error: 'message mismatch' }, { status: 400 })
  }

  let verified = false
  try {
    verified = await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 400 })
  }
  if (!verified) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const owns = await verifyOwnership(wallet, tokenId)
  if (!owns) {
    return NextResponse.json({ error: 'u dont own dis savant' }, { status: 403 })
  }

  const currentSlots = await getEquipped(tokenId)

  const validation = validateTraitChange(currentSlots, changes)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const allChanges = validation.autoChanges
    ? [...changes, ...validation.autoChanges]
    : changes

  const newComboHash = computeComboHash(validation.finalSlots)

  const taken = await isComboTaken(newComboHash, tokenId)
  if (taken) {
    return NextResponse.json({ error: 'dat trait combo already taken by another savant' }, { status: 409 })
  }

  const callerAddr = wallet.toLowerCase() as `0x${string}`

  if (allChanges.length === 1) {
    const change = allChanges[0]
    const oldTraitId = currentSlots[change.slot]

    if (change.newTraitId === 0 && oldTraitId !== 0) {
      const sig = await signUnequip(tokenId, change.slot, newComboHash, callerAddr)
      return NextResponse.json({
        operation: 'unequip',
        tokenId,
        slot: change.slot,
        traitId: oldTraitId,
        newComboHash,
        ...sig,
        deadline: sig.deadline.toString(),
        nonce: sig.nonce.toString(),
      })
    }

    if (change.newTraitId !== 0 && oldTraitId === 0) {
      const sig = await signEquip(tokenId, change.slot, change.newTraitId, newComboHash, callerAddr)
      return NextResponse.json({
        operation: 'equip',
        tokenId,
        slot: change.slot,
        traitId: change.newTraitId,
        newComboHash,
        ...sig,
        deadline: sig.deadline.toString(),
        nonce: sig.nonce.toString(),
      })
    }

    if (change.newTraitId !== 0 && oldTraitId !== 0) {
      const sig = await signSwap(tokenId, change.slot, change.newTraitId, newComboHash, callerAddr)
      return NextResponse.json({
        operation: 'swap',
        tokenId,
        slot: change.slot,
        oldTraitId,
        newTraitId: change.newTraitId,
        newComboHash,
        ...sig,
        deadline: sig.deadline.toString(),
        nonce: sig.nonce.toString(),
      })
    }
  }

  const slots = allChanges.map(c => c.slot)
  const newTraitIds = allChanges.map(c => c.newTraitId)
  const sig = await signBatchModify(tokenId, slots, newTraitIds, newComboHash, callerAddr)

  return NextResponse.json({
    operation: 'batchModify',
    tokenId,
    slots,
    newTraitIds,
    autoChanges: validation.autoChanges,
    newComboHash,
    ...sig,
    deadline: sig.deadline.toString(),
    nonce: sig.nonce.toString(),
  })
}
