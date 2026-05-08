// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SavantTraits
 * @dev Companion contract for equipment slots and IQ system.
 *      Reads ownership from SavantToken. Deploy post-mint.
 */
contract SavantTraits is Ownable {
    IERC721 public immutable savantToken;

    enum SlotType {
        BGS, BODS, CLOTHS, SPESHUL, FAYCE,
        FACESSORIES, HATSS, EXTRUHS, TEXTUH, NOISE
    }

    struct Traits {
        uint256[10] slots;
        uint256 iq;
        string customName;
        string customLore;
    }

    mapping(uint256 => Traits) private _traits;
    mapping(address => bool) public authorizedMutators;

    event TraitUpdated(uint256 indexed tokenId, SlotType slot, uint256 traitId);
    event IQUpdated(uint256 indexed tokenId, uint256 newIQ);
    event NameChanged(uint256 indexed tokenId, string newName);
    event LoreChanged(uint256 indexed tokenId, string newLore);
    event MutatorUpdated(address indexed mutator, bool authorized);

    modifier onlyMutator() {
        require(authorizedMutators[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(savantToken.ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    constructor(address _savantToken) {
        savantToken = IERC721(_savantToken);
    }

    // --- Mutator Management ---

    function setMutator(address mutator, bool authorized) external onlyOwner {
        authorizedMutators[mutator] = authorized;
        emit MutatorUpdated(mutator, authorized);
    }

    // --- Equipment (mutator only) ---

    function setSlotTrait(uint256 tokenId, SlotType slot, uint256 traitId) external onlyMutator {
        require(savantToken.ownerOf(tokenId) != address(0), "Token does not exist");
        _traits[tokenId].slots[uint256(slot)] = traitId;
        emit TraitUpdated(tokenId, slot, traitId);
    }

    function batchSetTraits(
        uint256 tokenId,
        uint256[10] calldata slots
    ) external onlyMutator {
        require(savantToken.ownerOf(tokenId) != address(0), "Token does not exist");
        _traits[tokenId].slots = slots;
    }

    // --- IQ (mutator only) ---

    function setIQ(uint256 tokenId, uint256 newIQ) external onlyMutator {
        require(savantToken.ownerOf(tokenId) != address(0), "Token does not exist");
        _traits[tokenId].iq = newIQ;
        emit IQUpdated(tokenId, newIQ);
    }

    function addIQ(uint256 tokenId, uint256 amount) external onlyMutator {
        require(savantToken.ownerOf(tokenId) != address(0), "Token does not exist");
        _traits[tokenId].iq += amount;
        emit IQUpdated(tokenId, _traits[tokenId].iq);
    }

    // --- Owner Customization (token holder only) ---

    function setName(uint256 tokenId, string calldata newName) external onlyTokenOwner(tokenId) {
        require(bytes(newName).length <= 25, "Name too long");
        _traits[tokenId].customName = newName;
        emit NameChanged(tokenId, newName);
    }

    function setLore(uint256 tokenId, string calldata newLore) external onlyTokenOwner(tokenId) {
        _traits[tokenId].customLore = newLore;
        emit LoreChanged(tokenId, newLore);
    }

    // --- Read Functions ---

    function getSlotTrait(uint256 tokenId, SlotType slot) external view returns (uint256) {
        return _traits[tokenId].slots[uint256(slot)];
    }

    function getAllTraits(uint256 tokenId) external view returns (uint256[10] memory) {
        return _traits[tokenId].slots;
    }

    function getIQ(uint256 tokenId) external view returns (uint256) {
        return _traits[tokenId].iq;
    }

    function getName(uint256 tokenId) external view returns (string memory) {
        return _traits[tokenId].customName;
    }

    function getLore(uint256 tokenId) external view returns (string memory) {
        return _traits[tokenId].customLore;
    }

    function getFullTraits(uint256 tokenId) external view returns (
        uint256[10] memory slots,
        uint256 iq,
        string memory customName,
        string memory customLore
    ) {
        Traits storage t = _traits[tokenId];
        return (t.slots, t.iq, t.customName, t.customLore);
    }
}
