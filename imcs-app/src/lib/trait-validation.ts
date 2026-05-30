import { encodePacked, keccak256 } from 'viem'
import {
  traits,
  traitLinks,
  traitExclusions,
  FULL_FACE_AYEZZ,
  REQUIRED_SLOTS,
  NUM_SLOTS,
  traitLayer,
} from './trait-data'

export type SlotChange = {
  slot: number
  newTraitId: number
}

export function computeComboHash(slots: number[]): `0x${string}` {
  return keccak256(
    encodePacked(
      ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      slots.map(BigInt) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
    )
  )
}

export function validateTraitChange(
  currentSlots: number[],
  changes: SlotChange[],
): { valid: boolean; error?: string; finalSlots: number[]; autoChanges?: SlotChange[] } {
  const finalSlots = [...currentSlots]
  const allChanges = [...changes]
  const autoChanges: SlotChange[] = []

  for (const change of changes) {
    if (change.slot < 0 || change.slot >= NUM_SLOTS) {
      return { valid: false, error: `Invalid slot ${change.slot}`, finalSlots }
    }

    if (change.newTraitId !== 0 && !traits[change.newTraitId]) {
      return { valid: false, error: `Unknown trait ${change.newTraitId}`, finalSlots }
    }

    if (change.newTraitId !== 0 && traitLayer(change.newTraitId) !== change.slot) {
      return { valid: false, error: `Trait ${change.newTraitId} doesn't belong in slot ${change.slot}`, finalSlots }
    }

    if (change.newTraitId !== 0 && traits[change.newTraitId]?.hidden) {
      return { valid: false, error: `Cannot equip hidden trait ${change.newTraitId}`, finalSlots }
    }
  }

  for (const change of changes) {
    finalSlots[change.slot] = change.newTraitId
  }

  // Full-face AYEZZ link logic
  const ayezzChange = changes.find(c => c.slot === 4)
  if (ayezzChange) {
    const isEquippingFullFace = FULL_FACE_AYEZZ.has(ayezzChange.newTraitId)
    const moufsChange = changes.find(c => c.slot === 5)

    if (isEquippingFullFace && moufsChange && moufsChange.newTraitId !== 0) {
      return { valid: false, error: 'Full-face ayezz cannot be combined with a visible moufs trait', finalSlots }
    }

    if (isEquippingFullFace && !moufsChange) {
      finalSlots[5] = 0
      const auto = { slot: 5, newTraitId: 0 }
      allChanges.push(auto)
      autoChanges.push(auto)
    }

    if (!isEquippingFullFace && ayezzChange.newTraitId !== 0) {
      const currentAyezz = currentSlots[4]
      const wasFullFace = FULL_FACE_AYEZZ.has(currentAyezz)
      if (wasFullFace && !moufsChange) {
        return { valid: false, error: 'Swapping from full-face ayezz requires selecting a moufs trait', finalSlots }
      }
    }
  }

  // Validate MOUFS not empty unless full-face AYEZZ
  if (finalSlots[5] === 0 && !FULL_FACE_AYEZZ.has(finalSlots[4])) {
    return { valid: false, error: 'moufs cannot be empty without full-face ayezz', finalSlots }
  }

  // Required slots check (BGS, BODS, AYEZZ)
  for (const slot of REQUIRED_SLOTS) {
    if (finalSlots[slot] === 0) {
      return { valid: false, error: `Required slot ${slot} cannot be empty`, finalSlots }
    }
  }

  // Trait links validation
  for (const link of traitLinks) {
    const triggerSlot = traitLayer(link.triggerTraitId)
    if (finalSlots[triggerSlot] === link.triggerTraitId) {
      const requiredSlot = traitLayer(link.requiredTraitId)
      if (traits[link.requiredTraitId]?.hidden) continue // hidden links handled by auto-unequip
      if (finalSlots[requiredSlot] !== link.requiredTraitId) {
        return { valid: false, error: `Trait ${link.triggerTrait} requires ${link.requiredTrait}`, finalSlots }
      }
    }
  }

  // Trait exclusions validation
  for (const exc of traitExclusions) {
    const slot1 = traitLayer(exc.trait1Id)
    const slot2 = traitLayer(exc.trait2Id)
    if (finalSlots[slot1] === exc.trait1Id && finalSlots[slot2] === exc.trait2Id) {
      return { valid: false, error: `${exc.trait1} and ${exc.trait2} cannot be equipped together`, finalSlots }
    }
  }

  return { valid: true, finalSlots, autoChanges: autoChanges.length > 0 ? autoChanges : undefined }
}
