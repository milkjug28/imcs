// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

interface ISavantEquipment {
    function mint(address to, uint256 id, uint256 amount) external;
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract SavantEquipManager is Ownable, ReentrancyGuard, EIP712, ERC1155Holder {
    ISavantEquipment public equipment;
    address public authorizedSigner;
    bool public claimsEnabled;

    uint256 public constant NUM_SLOTS = 10;
    uint256 public constant MAX_TOKEN_ID = 4269;

    // Bitmask: slots 0 (BGS), 1 (BODS), 4 (AYEZZ) are required
    // MOUFS (5) is conditionally required - backend enforces via trait links
    uint256 public constant REQUIRED_SLOTS_MASK = (1 << 0) | (1 << 1) | (1 << 4);

    mapping(uint256 => uint256[10]) private _equipped;
    mapping(bytes32 => uint256) public comboToToken;
    mapping(uint256 => bytes32) public tokenToCombo;
    mapping(bytes32 => bool) public usedSignatures;

    bytes32 public constant EQUIP_TYPEHASH = keccak256(
        "Equip(uint256 tokenId,uint256 slot,uint256 traitId,bytes32 newComboHash,address caller,uint256 deadline,uint256 nonce)"
    );
    bytes32 public constant UNEQUIP_TYPEHASH = keccak256(
        "Unequip(uint256 tokenId,uint256 slot,bytes32 newComboHash,address caller,uint256 deadline,uint256 nonce)"
    );
    bytes32 public constant SWAP_TYPEHASH = keccak256(
        "Swap(uint256 tokenId,uint256 slot,uint256 newTraitId,bytes32 newComboHash,address caller,uint256 deadline,uint256 nonce)"
    );
    bytes32 public constant BATCH_MODIFY_TYPEHASH = keccak256(
        "BatchModify(uint256 tokenId,bytes32 slotsHash,bytes32 traitsHash,bytes32 newComboHash,address caller,uint256 deadline,uint256 nonce)"
    );

    event Equipped(uint256 indexed tokenId, uint256 slot, uint256 traitId);
    event Unequipped(uint256 indexed tokenId, uint256 slot, uint256 traitId);
    event Swapped(uint256 indexed tokenId, uint256 slot, uint256 oldTraitId, uint256 newTraitId);
    event BatchModified(uint256 indexed tokenId, uint256[] slots, uint256[] newTraitIds);
    event ComboHashSeeded(uint256 indexed tokenId, bytes32 comboHash);
    event EquipmentSeeded(uint256 indexed tokenId);

    constructor(
        address _equipment,
        string memory name,
        string memory version
    ) EIP712(name, version) {
        equipment = ISavantEquipment(_equipment);
    }

    // ──────────────── Admin ────────────────

    function setAuthorizedSigner(address signer) external onlyOwner {
        authorizedSigner = signer;
    }

    function setClaimsEnabled(bool enabled) external onlyOwner {
        claimsEnabled = enabled;
    }

    function setEquipment(address _equipment) external onlyOwner {
        equipment = ISavantEquipment(_equipment);
    }

    function seedComboHashes(
        uint256[] calldata tokenIds,
        bytes32[] calldata hashes
    ) external onlyOwner {
        require(tokenIds.length == hashes.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(hashes[i] != bytes32(0), "Invalid combo hash");
            require(
                comboToToken[hashes[i]] == 0 || comboToToken[hashes[i]] == tokenIds[i],
                "Duplicate combo hash"
            );
            comboToToken[hashes[i]] = tokenIds[i];
            tokenToCombo[tokenIds[i]] = hashes[i];
            emit ComboHashSeeded(tokenIds[i], hashes[i]);
        }
    }

    function seedEquipment(
        uint256[] calldata tokenIds,
        uint256[10][] calldata slots
    ) external onlyOwner {
        require(tokenIds.length == slots.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _equipped[tokenIds[i]] = slots[i];
            emit EquipmentSeeded(tokenIds[i]);
        }
    }

    // ──────────────── Unequip ────────────────

    function unequip(
        uint256 tokenId,
        uint256 slot,
        bytes32 newComboHash,
        bytes calldata signature,
        uint256 deadline,
        uint256 nonce
    ) external nonReentrant {
        require(claimsEnabled, "Not enabled");
        require(block.timestamp <= deadline, "Expired");
        require(slot < NUM_SLOTS, "Invalid slot");
        require((REQUIRED_SLOTS_MASK & (1 << slot)) == 0, "Required slot");

        bytes32 structHash = keccak256(abi.encode(
            UNEQUIP_TYPEHASH, tokenId, slot, newComboHash, msg.sender, deadline, nonce
        ));
        _verifySignature(structHash, signature);

        uint256 currentTraitId = _equipped[tokenId][slot];
        require(currentTraitId != 0, "Slot empty");

        _equipped[tokenId][slot] = 0;
        _updateCombo(tokenId, newComboHash);

        equipment.safeTransferFrom(address(this), msg.sender, currentTraitId, 1, "");

        emit Unequipped(tokenId, slot, currentTraitId);
    }

    // ──────────────── Equip ────────────────

    function equip(
        uint256 tokenId,
        uint256 slot,
        uint256 traitId,
        bytes32 newComboHash,
        bytes calldata signature,
        uint256 deadline,
        uint256 nonce
    ) external nonReentrant {
        require(claimsEnabled, "Not enabled");
        require(block.timestamp <= deadline, "Expired");
        require(slot < NUM_SLOTS, "Invalid slot");
        require(traitId != 0, "Invalid trait");
        require(_equipped[tokenId][slot] == 0, "Slot occupied");

        bytes32 structHash = keccak256(abi.encode(
            EQUIP_TYPEHASH, tokenId, slot, traitId, newComboHash, msg.sender, deadline, nonce
        ));
        _verifySignature(structHash, signature);

        _equipped[tokenId][slot] = traitId;
        _updateCombo(tokenId, newComboHash);

        equipment.safeTransferFrom(msg.sender, address(this), traitId, 1, "");

        emit Equipped(tokenId, slot, traitId);
    }

    // ──────────────── Swap ────────────────

    function swap(
        uint256 tokenId,
        uint256 slot,
        uint256 newTraitId,
        bytes32 newComboHash,
        bytes calldata signature,
        uint256 deadline,
        uint256 nonce
    ) external nonReentrant {
        require(claimsEnabled, "Not enabled");
        require(block.timestamp <= deadline, "Expired");
        require(slot < NUM_SLOTS, "Invalid slot");
        require(newTraitId != 0, "Invalid trait");

        bytes32 structHash = keccak256(abi.encode(
            SWAP_TYPEHASH, tokenId, slot, newTraitId, newComboHash, msg.sender, deadline, nonce
        ));
        _verifySignature(structHash, signature);

        uint256 oldTraitId = _equipped[tokenId][slot];
        require(oldTraitId != 0, "Slot empty");
        require(oldTraitId != newTraitId, "Same trait");

        _equipped[tokenId][slot] = newTraitId;
        _updateCombo(tokenId, newComboHash);

        // Transfer old trait out to caller, new trait in from caller
        equipment.safeTransferFrom(address(this), msg.sender, oldTraitId, 1, "");
        equipment.safeTransferFrom(msg.sender, address(this), newTraitId, 1, "");

        emit Swapped(tokenId, slot, oldTraitId, newTraitId);
    }

    // ──────────────── Batch Modify ────────────────

    function batchModify(
        uint256 tokenId,
        uint256[] calldata slots,
        uint256[] calldata newTraitIds,
        bytes32 newComboHash,
        bytes calldata signature,
        uint256 deadline,
        uint256 nonce
    ) external nonReentrant {
        require(claimsEnabled, "Not enabled");
        require(block.timestamp <= deadline, "Expired");
        require(slots.length == newTraitIds.length, "Length mismatch");
        require(slots.length > 0, "Empty batch");

        _verifySignature(keccak256(abi.encode(
            BATCH_MODIFY_TYPEHASH,
            tokenId,
            keccak256(abi.encodePacked(slots)),
            keccak256(abi.encodePacked(newTraitIds)),
            newComboHash,
            msg.sender,
            deadline,
            nonce
        )), signature);

        _executeBatch(tokenId, slots, newTraitIds);
        _updateCombo(tokenId, newComboHash);

        emit BatchModified(tokenId, slots, newTraitIds);
    }

    function _executeBatch(
        uint256 tokenId,
        uint256[] calldata slots,
        uint256[] calldata newTraitIds
    ) internal {
        for (uint256 i = 0; i < slots.length; i++) {
            require(slots[i] < NUM_SLOTS, "Invalid slot");
            uint256 oldTraitId = _equipped[tokenId][slots[i]];

            if (newTraitIds[i] == 0) {
                require((REQUIRED_SLOTS_MASK & (1 << slots[i])) == 0, "Required slot");
                require(oldTraitId != 0, "Slot empty");
                _equipped[tokenId][slots[i]] = 0;
                equipment.safeTransferFrom(address(this), msg.sender, oldTraitId, 1, "");
            } else if (oldTraitId == 0) {
                _equipped[tokenId][slots[i]] = newTraitIds[i];
                equipment.safeTransferFrom(msg.sender, address(this), newTraitIds[i], 1, "");
            } else if (oldTraitId != newTraitIds[i]) {
                _equipped[tokenId][slots[i]] = newTraitIds[i];
                equipment.safeTransferFrom(address(this), msg.sender, oldTraitId, 1, "");
                equipment.safeTransferFrom(msg.sender, address(this), newTraitIds[i], 1, "");
            }
        }
    }

    // ──────────────── Read ────────────────

    function getEquipped(uint256 tokenId) external view returns (uint256[10] memory) {
        return _equipped[tokenId];
    }

    function getSlot(uint256 tokenId, uint256 slot) external view returns (uint256) {
        require(slot < NUM_SLOTS, "Invalid slot");
        return _equipped[tokenId][slot];
    }

    function isSlotRequired(uint256 slot) external pure returns (bool) {
        return (REQUIRED_SLOTS_MASK & (1 << slot)) != 0;
    }

    // ──────────────── Internal ────────────────

    function _verifySignature(bytes32 structHash, bytes calldata signature) internal {
        bytes32 digest = _hashTypedDataV4(structHash);
        require(!usedSignatures[digest], "Signature used");
        usedSignatures[digest] = true;

        address signer = ECDSA.recover(digest, signature);
        require(signer == authorizedSigner, "Invalid signer");
    }

    function _updateCombo(uint256 tokenId, bytes32 newComboHash) internal {
        require(newComboHash != bytes32(0), "Invalid combo hash");

        bytes32 oldHash = tokenToCombo[tokenId];

        if (oldHash != bytes32(0)) {
            delete comboToToken[oldHash];
        }

        require(
            comboToToken[newComboHash] == 0 || comboToToken[newComboHash] == tokenId,
            "Combo taken"
        );

        comboToToken[newComboHash] = tokenId;
        tokenToCombo[tokenId] = newComboHash;
    }
}
