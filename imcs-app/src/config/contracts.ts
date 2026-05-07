import { base } from 'wagmi/chains'

export const SAVANT_TOKEN_ADDRESS = '0x3F5A780E03a9403a58521Fb04ecbc021ceCa53Ec' as const
export const SEADROP_ADDRESS = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5' as const
export const FEE_RECIPIENT = '0x87a2ECbfA6481dcF91a5e6f1A2dE0B7D4CF5Ba39' as const
export const MINT_CHAIN = base

export const SEADROP_ABI = [
  {
    name: 'mintAllowList',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'nftContract', type: 'address' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'minterIfNotPayer', type: 'address' },
      { name: 'quantity', type: 'uint256' },
      {
        name: 'mintParams',
        type: 'tuple',
        components: [
          { name: 'mintPrice', type: 'uint256' },
          { name: 'maxTotalMintableByWallet', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'dropStageIndex', type: 'uint256' },
          { name: 'maxTokenSupplyForStage', type: 'uint256' },
          { name: 'feeBps', type: 'uint256' },
          { name: 'restrictFeeRecipients', type: 'bool' },
        ],
      },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  {
    name: 'mintPublic',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'nftContract', type: 'address' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'minterIfNotPayer', type: 'address' },
      { name: 'quantity', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getMintStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'nftContract', type: 'address' },
      { name: 'minter', type: 'address' },
    ],
    outputs: [
      { name: 'minterNumMinted', type: 'uint256' },
      { name: 'currentTotalSupply', type: 'uint256' },
      { name: 'maxSupply', type: 'uint256' },
    ],
  },
] as const

export const SAVANT_TOKEN_ABI = [
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'maxSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getMintStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'minter', type: 'address' }],
    outputs: [
      { name: 'minterNumMinted', type: 'uint256' },
      { name: 'currentTotalSupply', type: 'uint256' },
      { name: 'maxSupply', type: 'uint256' },
    ],
  },
] as const
