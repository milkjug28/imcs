// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

interface ISavantEquipment {
    function mint(address to, uint256 id, uint256 amount) external;
    function burn(address account, uint256 id, uint256 amount) external;
    function totalSupply(uint256 id) external view returns (uint256);
    function maxSupply(uint256 id) external view returns (uint256);
}

/// @notice Card-pack distribution for IMCS new traits. Pack = burnable 1155 token.
/// Opening requests Chainlink VRF; callback draws 3 slots. Each slot rolls a trait
/// (weighted by remaining pool supply) or an IQ-booster card. When the trait pool is
/// empty, ripping closes (season over) until a new trait drop reseeds the pool.
/// Booster outcomes are emitted as events; the backend credits IQ allocation off-chain.
contract SavantPack is VRFConsumerBaseV2Plus {
    ISavantEquipment public immutable equipment;
    uint256 public immutable packTokenId;

    // --- VRF config ---
    bytes32 public keyHash;
    uint256 public subId;
    uint16 public requestConfirmations = 3;
    uint32 public callbackGasLimit = 500_000;
    bool public nativePayment = true; // true = pay VRF fee in native ETH (Base); false = LINK
    uint32 private constant NUM_WORDS = 1;

    // --- Draw config ---
    uint8 public constant SLOTS = 3;
    uint16 public traitChanceBps = 8000; // 80% trait, 20% booster
    uint16 public dudChanceBps = 150; // ~1.5% of packs lose one slot (pull 2, not 3)

    // Trait pool: weighted by remaining supply (natural rarity)
    uint256[] public poolTokenIds;
    mapping(uint256 => uint256) public remaining; // tokenId => units left in pool
    uint256 public totalRemaining;

    // IQ booster cards: amount (IQ) + selection weight
    uint256[] public boosterAmounts; // e.g. [5,10,15,25]
    uint256[] public boosterWeights; // e.g. [10,7,3,1]
    uint256 public totalBoosterWeight;

    // Purchasing
    uint256 public packPrice;
    bool public saleOpen;

    // Per-wallet lifetime mint cap. Users may buy/hold more on secondary,
    // but each wallet can only mint (buyPack) up to this many.
    uint256 public constant MAX_MINT_PER_WALLET = 10;
    mapping(address => uint256) public mintedPerWallet;

    // VRF request tracking
    mapping(uint256 => address) public requestOpener;

    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    event PackPurchased(address indexed buyer, uint256 amount, uint256 paid);
    event PackAirdropped(address indexed to, uint256 amount);
    event PackOpenRequested(address indexed opener, uint256 indexed requestId);
    event TraitWon(address indexed opener, uint256 indexed requestId, uint256 traitTokenId);
    event BoosterWon(address indexed opener, uint256 indexed requestId, uint256 iqAmount);
    event SlotDud(address indexed opener, uint256 indexed requestId, uint256 slot);
    event SeasonClosed(uint256 indexed requestId);
    event PoolSeeded(uint256 totalUnits, uint256 distinctTraits);

    constructor(
        address _coordinator,
        address _equipment,
        uint256 _packTokenId,
        bytes32 _keyHash,
        uint256 _subId
    ) VRFConsumerBaseV2Plus(_coordinator) {
        equipment = ISavantEquipment(_equipment);
        packTokenId = _packTokenId;
        keyHash = _keyHash;
        subId = _subId;
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    /// @notice Seed/replace the trait pool. tokenIds are the NEW trait 1155 ids;
    /// amounts are the per-trait supply that can be pulled this season.
    function seedPool(uint256[] calldata tokenIds, uint256[] calldata amounts) external onlyOwner {
        require(tokenIds.length == amounts.length, "len");
        // clear previous
        for (uint256 i = 0; i < poolTokenIds.length; i++) {
            remaining[poolTokenIds[i]] = 0;
        }
        delete poolTokenIds;
        uint256 total;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(amounts[i] > 0, "zero amount");
            poolTokenIds.push(tokenIds[i]);
            remaining[tokenIds[i]] = amounts[i];
            total += amounts[i];
        }
        totalRemaining = total;
        emit PoolSeeded(total, tokenIds.length);
    }

    function setBoosterTiers(uint256[] calldata amounts, uint256[] calldata weights) external onlyOwner {
        require(amounts.length == weights.length && amounts.length > 0, "len");
        uint256 w;
        for (uint256 i = 0; i < weights.length; i++) w += weights[i];
        require(w > 0, "weight");
        boosterAmounts = amounts;
        boosterWeights = weights;
        totalBoosterWeight = w;
    }

    function setTraitChanceBps(uint16 bps) external onlyOwner {
        require(bps <= 10000, "bps");
        traitChanceBps = bps;
    }

    function setDudChanceBps(uint16 bps) external onlyOwner {
        require(bps <= 10000, "bps");
        dudChanceBps = bps;
    }

    function setVrfConfig(
        bytes32 _keyHash,
        uint256 _subId,
        uint16 _confirmations,
        uint32 _callbackGasLimit,
        bool _nativePayment
    ) external onlyOwner {
        keyHash = _keyHash;
        subId = _subId;
        requestConfirmations = _confirmations;
        callbackGasLimit = _callbackGasLimit;
        nativePayment = _nativePayment;
    }

    function setSale(bool open, uint256 price) external onlyOwner {
        saleOpen = open;
        packPrice = price;
    }

    /// @notice Mint pack tokens to eligible holders (IQ-tier eligibility computed off-chain).
    function airdropPacks(address[] calldata to, uint256[] calldata amounts) external onlyOwner {
        require(to.length == amounts.length, "len");
        for (uint256 i = 0; i < to.length; i++) {
            equipment.mint(to[i], packTokenId, amounts[i]);
            emit PackAirdropped(to[i], amounts[i]);
        }
    }

    function withdraw(address payable dest) external onlyOwner {
        (bool ok, ) = dest.call{value: address(this).balance}("");
        require(ok, "withdraw");
    }

    // ---------------------------------------------------------------
    // User actions
    // ---------------------------------------------------------------

    function buyPack(uint256 amount) external payable nonReentrant {
        require(saleOpen, "sale closed");
        require(amount > 0, "amount");
        require(mintedPerWallet[msg.sender] + amount <= MAX_MINT_PER_WALLET, "mint cap");
        require(msg.value >= packPrice * amount, "underpaid");
        mintedPerWallet[msg.sender] += amount;
        equipment.mint(msg.sender, packTokenId, amount);
        emit PackPurchased(msg.sender, amount, msg.value);
    }

    /// @notice Burn one pack and request randomness. Reverts if the season pool is empty.
    /// Caller must setApprovalForAll(this, true) on SavantEquipment so the pack can be burned.
    function openPack() external nonReentrant returns (uint256 requestId) {
        require(totalRemaining > 0, "season closed");
        equipment.burn(msg.sender, packTokenId, 1);

        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: nativePayment})
                )
            })
        );
        requestOpener[requestId] = msg.sender;
        emit PackOpenRequested(msg.sender, requestId);
    }

    // ---------------------------------------------------------------
    // VRF callback
    // ---------------------------------------------------------------

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        address opener = requestOpener[requestId];
        require(opener != address(0), "unknown request");
        delete requestOpener[requestId];

        uint256 seed = randomWords[0];

        // rare: at most one slot per pack yields nothing ("lost a card" prank)
        uint256 dudSlot = type(uint256).max;
        if (uint256(keccak256(abi.encode(seed, uint256(98)))) % 10000 < dudChanceBps) {
            dudSlot = uint256(keccak256(abi.encode(seed, uint256(99)))) % SLOTS;
        }

        for (uint256 slot = 0; slot < SLOTS; slot++) {
            if (slot == dudSlot) {
                emit SlotDud(opener, requestId, slot);
                continue;
            }

            // two independent draws per slot from the single VRF word
            uint256 rRoll = uint256(keccak256(abi.encode(seed, slot, uint256(0))));
            uint256 rPick = uint256(keccak256(abi.encode(seed, slot, uint256(1))));

            bool traitHit = (rRoll % 10000) < traitChanceBps && totalRemaining > 0;

            if (traitHit) {
                uint256 traitId = _drawTrait(rPick);
                remaining[traitId] -= 1;
                totalRemaining -= 1;
                equipment.mint(opener, traitId, 1);
                emit TraitWon(opener, requestId, traitId);
            } else {
                uint256 iq = _drawBooster(rPick);
                emit BoosterWon(opener, requestId, iq);
            }
        }

        if (totalRemaining == 0) emit SeasonClosed(requestId);
    }

    // ---------------------------------------------------------------
    // Weighted selection
    // ---------------------------------------------------------------

    /// @dev pick a trait id weighted by remaining supply (natural rarity). totalRemaining > 0 assumed.
    function _drawTrait(uint256 rand) internal view returns (uint256) {
        uint256 target = rand % totalRemaining;
        uint256 cum;
        uint256 n = poolTokenIds.length;
        for (uint256 i = 0; i < n; i++) {
            uint256 id = poolTokenIds[i];
            cum += remaining[id];
            if (target < cum) return id;
        }
        revert("pool drained"); // unreachable while totalRemaining > 0
    }

    /// @dev pick a booster IQ amount weighted by configured weights.
    function _drawBooster(uint256 rand) internal view returns (uint256) {
        uint256 target = rand % totalBoosterWeight;
        uint256 cum;
        for (uint256 i = 0; i < boosterWeights.length; i++) {
            cum += boosterWeights[i];
            if (target < cum) return boosterAmounts[i];
        }
        return boosterAmounts[boosterAmounts.length - 1];
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function poolSize() external view returns (uint256) {
        return poolTokenIds.length;
    }

    function seasonOpen() external view returns (bool) {
        return totalRemaining > 0;
    }
}
