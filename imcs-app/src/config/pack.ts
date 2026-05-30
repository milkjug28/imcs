import { base, baseSepolia } from 'wagmi/chains'

const USE_SEPOLIA = process.env.NEXT_PUBLIC_TRAIT_CHAIN_ENV === 'sepolia'
export const PACK_CHAIN = USE_SEPOLIA ? baseSepolia : base

export const PACK_ADDRESS = (process.env.NEXT_PUBLIC_PACK_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`
export const PACK_EQUIPMENT_ADDRESS = (process.env.NEXT_PUBLIC_EQUIPMENT_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export const PACK_TOKEN_ID = BigInt(process.env.NEXT_PUBLIC_PACK_TOKEN_ID || '999000')
export const PACK_PRICE_WEI = BigInt(process.env.NEXT_PUBLIC_PACK_PRICE_WEI || '690000000000000')

// OpenSea collection for the sealed pack token (empty-state fallback link).
export const PACK_OPENSEA_URL = process.env.NEXT_PUBLIC_PACK_OPENSEA_URL || ''

export const SAVANT_PACK_ABI = [
  { name: 'openPack', type: 'function', stateMutability: 'nonpayable', inputs: [],
    outputs: [{ name: 'requestId', type: 'uint256' }] },
  { name: 'buyPack', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'totalRemaining', type: 'function', stateMutability: 'view', inputs: [],
    outputs: [{ name: '', type: 'uint256' }] },
  { name: 'seasonOpen', type: 'function', stateMutability: 'view', inputs: [],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'saleOpen', type: 'function', stateMutability: 'view', inputs: [],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'packPrice', type: 'function', stateMutability: 'view', inputs: [],
    outputs: [{ name: '', type: 'uint256' }] },
  { type: 'event', name: 'PackOpenRequested', inputs: [
    { name: 'opener', type: 'address', indexed: true },
    { name: 'requestId', type: 'uint256', indexed: true } ] },
  { type: 'event', name: 'TraitWon', inputs: [
    { name: 'opener', type: 'address', indexed: true },
    { name: 'requestId', type: 'uint256', indexed: true },
    { name: 'traitTokenId', type: 'uint256', indexed: false } ] },
  { type: 'event', name: 'BoosterWon', inputs: [
    { name: 'opener', type: 'address', indexed: true },
    { name: 'requestId', type: 'uint256', indexed: true },
    { name: 'iqAmount', type: 'uint256', indexed: false } ] },
  { type: 'event', name: 'SlotDud', inputs: [
    { name: 'opener', type: 'address', indexed: true },
    { name: 'requestId', type: 'uint256', indexed: true },
    { name: 'slot', type: 'uint256', indexed: false } ] },
  { type: 'event', name: 'SeasonClosed', inputs: [
    { name: 'requestId', type: 'uint256', indexed: true } ] },
] as const

// equipment 1155 bits the pack flow needs: pack balance + burn approval.
export const PACK_EQUIPMENT_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [
    { name: 'account', type: 'address' }, { name: 'id', type: 'uint256' } ],
    outputs: [{ name: '', type: 'uint256' }] },
  { name: 'isApprovedForAll', type: 'function', stateMutability: 'view', inputs: [
    { name: 'account', type: 'address' }, { name: 'operator', type: 'address' } ],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'setApprovalForAll', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' } ],
    outputs: [] },
] as const
