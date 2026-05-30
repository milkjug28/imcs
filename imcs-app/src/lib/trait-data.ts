import traitMapData from '../../../imcs-deployment/data/trait-map.json'

export type TraitInfo = {
  traitId: number
  layer: number
  layerName: string
  slot: string
  index: number
  name: string
  filename: string
  rarity: number
  hidden: boolean
  isNew?: boolean
  newPath?: string
}

export type TraitLink = {
  triggerLayer: string
  triggerTrait: string
  triggerTraitId: number
  requiredLayer: string
  requiredTrait: string
  requiredTraitId: number
}

export type TraitExclusion = {
  layer1: string
  trait1: string
  trait1Id: number
  layer2: string
  trait2: string
  trait2Id: number
}

export const NUM_SLOTS = 10

export const SLOT_NAMES = ['BGS', 'BODS', 'CLOTHS', 'SPESHUL', 'AYEZZ', 'MOUFS', 'FACESSORIES', 'HATSS', 'EXTRUHS', 'TEXTUH'] as const

export const REQUIRED_SLOTS = new Set([0, 1, 4]) // BGS, BODS, AYEZZ

export const traits: Record<number, TraitInfo> = traitMapData.traits as Record<number, TraitInfo>

export const hiddenTraitIds: Record<number, number> = traitMapData.hiddenTraits as Record<number, number>

export const traitLinks: TraitLink[] = traitMapData.traitLinks as TraitLink[]

export const traitExclusions: TraitExclusion[] = traitMapData.traitExclusions as TraitExclusion[]

export const FULL_FACE_AYEZZ = new Set(
  traitLinks
    .filter(l => l.requiredLayer === 'moufs' && traits[l.requiredTraitId]?.hidden)
    .map(l => l.triggerTraitId)
)

export function getLinksForTrait(traitId: number): TraitLink[] {
  return traitLinks.filter(l => l.triggerTraitId === traitId)
}

export function getExclusionsForTrait(traitId: number): TraitExclusion[] {
  return traitExclusions.filter(e => e.trait1Id === traitId || e.trait2Id === traitId)
}

export function traitLayer(traitId: number): number {
  return Math.floor((traitId - 1) / 1000)
}
