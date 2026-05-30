import { traits } from './trait-data'
import { normalizeTrait } from './trait-normalize'

// IQ-booster traits: equipping one grows the wearing savant's IQ by a %.
// Keyed by traitId. Extruh body-variants each get their own entry.
export const TRAIT_BOOSTERS: Record<number, number> = {
  27: 1, // peekah suhprize (bg)
  28: 1, // wp2808001 (bg)
  2034: 5, // blasstoyce (cloths)
  4017: 2.5, // susss (ayezz)
  5015: 2.5, // raynboh deemon grell (moufs)
  7041: 5, // nurow leenk (hatss)
  8018: 5, // explooror staaf derk (extruhs)
  8019: 5, // explooror staaf lyte (extruhs)
  8020: 5, // explooror staaf ayeliun (extruhs)
}

export function boosterPct(traitId: number): number {
  return TRAIT_BOOSTERS[traitId] ?? 0
}

// Total boost % from a savant's equipped slots (additive).
export function totalBoostPct(slots: number[]): number {
  return slots.reduce((sum, id) => sum + boosterPct(id), 0)
}

// Normalized booster trait name -> pct (built from TRAIT_BOOSTERS). Lets the
// savant metadata route derive boost from its already-stored attribute values
// (which hold normalized trait names) without a chain read.
const BOOSTER_NAMES: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  for (const idStr in TRAIT_BOOSTERS) {
    const t = traits[Number(idStr)]
    if (!t) continue
    out[normalizeTrait(t.layerName, t.name)] = TRAIT_BOOSTERS[idStr]
  }
  return out
})()

// Sum boost % from savant metadata attributes (trait_type = layer, value = name).
export function boostPctFromAttributes(
  attrs: { trait_type: string; value: string }[]
): number {
  let sum = 0
  for (const a of attrs) {
    sum += BOOSTER_NAMES[a.value] ?? 0
  }
  return sum
}
