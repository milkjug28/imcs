import { mainnet } from 'wagmi/chains'

export const SAVANT_TOKEN_ADDRESS = '0x95fa6fc553F5bE3160b191b0133236367A835C63' as const
export const SEADROP_ADDRESS = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5' as const
export const FEE_RECIPIENT = '0x6878144669e7E558737FEB3820410174CEef04e6' as const
export const MINT_CHAIN = mainnet

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
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
