import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { EQUIP_MANAGER_ADDRESS } from './base-client'

let _account: ReturnType<typeof privateKeyToAccount> | null = null
function getAccount() {
  if (!_account) {
    _account = privateKeyToAccount(process.env.MUTATOR_PRIVATE_KEY as `0x${string}`)
  }
  return _account
}

function getDomain() {
  return {
    name: 'SavantEquipManager' as const,
    version: '1' as const,
    chainId: base.id,
    verifyingContract: EQUIP_MANAGER_ADDRESS,
  }
}

const DEADLINE_SECONDS = 300 // 5 minutes

let nonceCounter = Date.now()
function nextNonce(): bigint {
  return BigInt(nonceCounter++)
}

export async function signEquip(
  tokenId: number,
  slot: number,
  traitId: number,
  newComboHash: `0x${string}`,
  caller: `0x${string}`,
): Promise<{ signature: `0x${string}`; deadline: bigint; nonce: bigint }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)
  const nonce = nextNonce()

  const signature = await getAccount().signTypedData({
    domain: getDomain(),
    types: {
      Equip: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'slot', type: 'uint256' },
        { name: 'traitId', type: 'uint256' },
        { name: 'newComboHash', type: 'bytes32' },
        { name: 'caller', type: 'address' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'Equip',
    message: {
      tokenId: BigInt(tokenId),
      slot: BigInt(slot),
      traitId: BigInt(traitId),
      newComboHash,
      caller,
      deadline,
      nonce,
    },
  })

  return { signature, deadline, nonce }
}

export async function signUnequip(
  tokenId: number,
  slot: number,
  newComboHash: `0x${string}`,
  caller: `0x${string}`,
): Promise<{ signature: `0x${string}`; deadline: bigint; nonce: bigint }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)
  const nonce = nextNonce()

  const signature = await getAccount().signTypedData({
    domain: getDomain(),
    types: {
      Unequip: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'slot', type: 'uint256' },
        { name: 'newComboHash', type: 'bytes32' },
        { name: 'caller', type: 'address' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'Unequip',
    message: {
      tokenId: BigInt(tokenId),
      slot: BigInt(slot),
      newComboHash,
      caller,
      deadline,
      nonce,
    },
  })

  return { signature, deadline, nonce }
}

export async function signSwap(
  tokenId: number,
  slot: number,
  newTraitId: number,
  newComboHash: `0x${string}`,
  caller: `0x${string}`,
): Promise<{ signature: `0x${string}`; deadline: bigint; nonce: bigint }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)
  const nonce = nextNonce()

  const signature = await getAccount().signTypedData({
    domain: getDomain(),
    types: {
      Swap: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'slot', type: 'uint256' },
        { name: 'newTraitId', type: 'uint256' },
        { name: 'newComboHash', type: 'bytes32' },
        { name: 'caller', type: 'address' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'Swap',
    message: {
      tokenId: BigInt(tokenId),
      slot: BigInt(slot),
      newTraitId: BigInt(newTraitId),
      newComboHash,
      caller,
      deadline,
      nonce,
    },
  })

  return { signature, deadline, nonce }
}

export async function signBatchModify(
  tokenId: number,
  slots: number[],
  newTraitIds: number[],
  newComboHash: `0x${string}`,
  caller: `0x${string}`,
): Promise<{ signature: `0x${string}`; deadline: bigint; nonce: bigint }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)
  const nonce = nextNonce()

  const { encodePacked, keccak256 } = await import('viem')
  const slotsHash = keccak256(encodePacked(['uint256[]'], [slots.map(BigInt)]))
  const traitsHash = keccak256(encodePacked(['uint256[]'], [newTraitIds.map(BigInt)]))

  const signature = await getAccount().signTypedData({
    domain: getDomain(),
    types: {
      BatchModify: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'slotsHash', type: 'bytes32' },
        { name: 'traitsHash', type: 'bytes32' },
        { name: 'newComboHash', type: 'bytes32' },
        { name: 'caller', type: 'address' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'BatchModify',
    message: {
      tokenId: BigInt(tokenId),
      slotsHash,
      traitsHash,
      newComboHash,
      caller,
      deadline,
      nonce,
    },
  })

  return { signature, deadline, nonce }
}
