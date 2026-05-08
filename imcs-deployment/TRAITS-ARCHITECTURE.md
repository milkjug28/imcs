# Savant Traits Architecture (Post-Mint)

## Timeline
- Not needed at mint. 3-7 days post-mint before quests/games go live.
- SavantTraits.sol deploys separately, references SavantToken for ownership.

## On-Chain
- SavantTraits.sol: 10 equipment slots, IQ system, custom name/lore
- Authorized mutators (game contracts, backend) can update traits
- Token holders can setName/setLore directly
- Trait ownership verified via ERC1155 token OR DB check before equip

## Rendering

### IPFS Renderer (animation_url)
- Static HTML+JS hosted on IPFS/Arweave
- Reads SavantTraits contract via RPC for current equipment
- Loads trait layer PNGs from IPFS trait folder
- Composites layers client-side on canvas
- Always shows current state, fully decentralized

### IPFS Folder Structure
```
ipfs://QmTraits/
  hats/party-hat.png
  hats/crown.png
  robes/kings-robe.png
  faces/goofy.png
  weapons/sword.png
  ...

ipfs://QmRenderer/
  index.html    <- reads tokenId from URL hash, fetches traits from contract, layers PNGs
```

### Metadata Pattern
```json
{
  "name": "Savant #42",
  "image": "https://api.imcs.world/render/42.png",
  "animation_url": "ipfs://QmRenderer/#42",
  "attributes": [{"trait_type": "Hat", "value": "Party Hat"}, ...]
}
```

- `image`: server-rendered PNG (thumbnails, social cards, OpenSea grid)
- `animation_url`: IPFS renderer (interactive, always current, decentralized)
- `attributes`: current traits served from API (reads SavantTraits contract)

### Refresh Cycle on Trait Change
1. Holder verifies trait ownership (ERC1155 on-chain or DB)
2. SavantTraits contract updated on-chain
3. Backend re-composites PNG server-side
4. Backend calls OpenSea refresh API for that tokenId
5. OpenSea re-fetches metadata + new PNG
6. animation_url iframe always loads fresh (no refresh needed)

### Trait Ownership
- Valuable/tradeable traits: ERC1155 tokens (on-chain, trustless)
- Quest rewards/basic unlocks: DB-verified (faster, simpler)
- Could support both

## OpenSea Caching Notes
- OpenSea indexes aggressively, caches images on CDN
- Refresh API exists but rate limited
- Metadata updates can take minutes to hours
- animation_url iframe always loads fresh
