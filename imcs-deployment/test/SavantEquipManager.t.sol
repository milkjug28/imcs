// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {SavantEquipment} from "../src/SavantEquipment.sol";
import {SavantEquipManager} from "../src/SavantEquipManager.sol";

contract SavantEquipManagerTest is Test {
    SavantEquipment public equipment;
    SavantEquipManager public manager;

    address deployer = address(0xA1);
    uint256 signerPk = 0xB0B;
    address signer;
    address user1 = address(0xCAFE);
    address user2 = address(0xBEEF);

    // Trait IDs matching our scheme: layer * 1000 + index + 1
    uint256 constant HAT_PARTI = 7024;   // HATSS slot (7), optional
    uint256 constant HAT_WIZZARD = 7036; // HATSS slot (7), optional
    uint256 constant EYES_ENTENCE = 4005; // AYEZZ slot (4), required
    uint256 constant EYES_CHADD = 4002;   // AYEZZ slot (4), required
    uint256 constant BG_BLU = 2;         // BGS slot (0), required
    uint256 constant BOD_DERK = 1002;    // BODS slot (1), required
    uint256 constant CLOTH_FSHERT = 2012; // CLOTHS slot (2), optional
    uint256 constant MOUF_MEEH = 5006;   // MOUFS slot (5), required

    function setUp() public {
        signer = vm.addr(signerPk);

        vm.startPrank(deployer);

        equipment = new SavantEquipment("https://imcs.world/api/traits/{id}");
        manager = new SavantEquipManager(address(equipment), "SavantEquipManager", "1");

        equipment.setMinter(address(manager), true);
        equipment.setMinter(deployer, true);
        manager.setAuthorizedSigner(signer);

        vm.stopPrank();
    }

    // ──────── Helpers ────────

    function _signEquip(
        uint256 tokenId,
        uint256 slot,
        uint256 traitId,
        bytes32 newComboHash,
        address caller,
        uint256 deadline,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            manager.EQUIP_TYPEHASH(), tokenId, slot, traitId, newComboHash, caller, deadline, nonce
        ));
        bytes32 digest = _getDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signUnequip(
        uint256 tokenId,
        uint256 slot,
        bytes32 newComboHash,
        address caller,
        uint256 deadline,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            manager.UNEQUIP_TYPEHASH(), tokenId, slot, newComboHash, caller, deadline, nonce
        ));
        bytes32 digest = _getDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signSwap(
        uint256 tokenId,
        uint256 slot,
        uint256 newTraitId,
        bytes32 newComboHash,
        address caller,
        uint256 deadline,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            manager.SWAP_TYPEHASH(), tokenId, slot, newTraitId, newComboHash, caller, deadline, nonce
        ));
        bytes32 digest = _getDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _getDigest(bytes32 structHash) internal view returns (bytes32) {
        // Replicate EIP712 _hashTypedDataV4
        bytes32 domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("SavantEquipManager"),
            keccak256("1"),
            block.chainid,
            address(manager)
        ));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _seedToken(uint256 tokenId, uint256[10] memory slots, bytes32 comboHash) internal {
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        uint256[10][] memory allSlots = new uint256[10][](1);
        allSlots[0] = slots;
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = comboHash;

        vm.startPrank(deployer);
        manager.seedEquipment(tokenIds, allSlots);
        manager.seedComboHashes(tokenIds, hashes);
        vm.stopPrank();
    }

    function _mintTraitToManager(uint256 traitId, uint256 amount) internal {
        vm.prank(deployer);
        equipment.mint(address(manager), traitId, amount);
    }

    function _mintTraitToUser(address user, uint256 traitId, uint256 amount) internal {
        vm.prank(deployer);
        equipment.mint(user, traitId, amount);
    }

    function _enableClaims() internal {
        vm.prank(deployer);
        manager.setClaimsEnabled(true);
    }

    // ──────── Seeding Tests ────────

    function test_SeedEquipment() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, CLOTH_FSHERT, uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 comboHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, comboHash);

        uint256[10] memory stored = manager.getEquipped(1);
        assertEq(stored[0], BG_BLU);
        assertEq(stored[1], BOD_DERK);
        assertEq(stored[7], HAT_PARTI);
        assertEq(manager.comboToToken(comboHash), 1);
        assertEq(manager.tokenToCombo(1), comboHash);
    }

    function test_SeedOnlyOwner() public {
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        uint256[10][] memory allSlots = new uint256[10][](1);
        bytes32[] memory hashes = new bytes32[](1);

        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        manager.seedEquipment(tokenIds, allSlots);

        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        manager.seedComboHashes(tokenIds, hashes);
    }

    // ──────── Unequip Tests ────────

    function test_UnequipOptionalSlot() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, CLOTH_FSHERT, uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 1);
        _enableClaims();

        // Compute new combo hash with hat slot = 0
        uint256[10] memory newSlots = slots;
        newSlots[7] = 0;
        bytes32 newHash = keccak256(abi.encodePacked(newSlots[0], newSlots[1], newSlots[2], newSlots[3], newSlots[4], newSlots[5], newSlots[6], newSlots[7], newSlots[8], newSlots[9]));

        bytes memory sig = _signUnequip(1, 7, newHash, user1, block.timestamp + 1 hours, 0);

        vm.prank(user1);
        manager.unequip(1, 7, newHash, sig, block.timestamp + 1 hours, 0);

        assertEq(manager.getSlot(1, 7), 0);
        assertEq(equipment.balanceOf(user1, HAT_PARTI), 1);
        assertEq(manager.comboToToken(newHash), 1);
    }

    function test_UnequipRequiredSlotReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, CLOTH_FSHERT, uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _enableClaims();

        bytes32 fakeHash = keccak256("fake");
        bytes memory sig = _signUnequip(1, 0, fakeHash, user1, block.timestamp + 1 hours, 0);

        vm.prank(user1);
        vm.expectRevert("Required slot");
        manager.unequip(1, 0, fakeHash, sig, block.timestamp + 1 hours, 0);

        // Slot 4 (AYEZZ) is required
        sig = _signUnequip(1, 4, fakeHash, user1, block.timestamp + 1 hours, 1);
        vm.prank(user1);
        vm.expectRevert("Required slot");
        manager.unequip(1, 4, fakeHash, sig, block.timestamp + 1 hours, 1);

        // Slot 5 (MOUFS) is NOT contract-required (backend enforces via trait links)
        // Slot 1 (BODS) is required
        sig = _signUnequip(1, 1, fakeHash, user1, block.timestamp + 1 hours, 2);
        vm.prank(user1);
        vm.expectRevert("Required slot");
        manager.unequip(1, 1, fakeHash, sig, block.timestamp + 1 hours, 2);
    }

    // ──────── Equip Tests ────────

    function test_EquipToEmptySlot() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), uint256(0), uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToUser(user1, HAT_PARTI, 1);
        _enableClaims();

        uint256[10] memory newSlots = slots;
        newSlots[7] = HAT_PARTI;
        bytes32 newHash = keccak256(abi.encodePacked(newSlots[0], newSlots[1], newSlots[2], newSlots[3], newSlots[4], newSlots[5], newSlots[6], newSlots[7], newSlots[8], newSlots[9]));

        bytes memory sig = _signEquip(1, 7, HAT_PARTI, newHash, user1, block.timestamp + 1 hours, 0);

        vm.startPrank(user1);
        equipment.setApprovalForAll(address(manager), true);
        manager.equip(1, 7, HAT_PARTI, newHash, sig, block.timestamp + 1 hours, 0);
        vm.stopPrank();

        assertEq(manager.getSlot(1, 7), HAT_PARTI);
        assertEq(equipment.balanceOf(user1, HAT_PARTI), 0);
        assertEq(equipment.balanceOf(address(manager), HAT_PARTI), 1);
    }

    function test_EquipOccupiedSlotReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToUser(user1, HAT_WIZZARD, 1);
        _enableClaims();

        bytes32 fakeHash = keccak256("fake");
        bytes memory sig = _signEquip(1, 7, HAT_WIZZARD, fakeHash, user1, block.timestamp + 1 hours, 0);

        vm.startPrank(user1);
        equipment.setApprovalForAll(address(manager), true);
        vm.expectRevert("Slot occupied");
        manager.equip(1, 7, HAT_WIZZARD, fakeHash, sig, block.timestamp + 1 hours, 0);
        vm.stopPrank();
    }

    // ──────── Swap Tests ────────

    function test_SwapRequiredSlot() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), uint256(0), uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(EYES_ENTENCE, 1);
        _mintTraitToUser(user1, EYES_CHADD, 1);
        _enableClaims();

        uint256[10] memory newSlots = slots;
        newSlots[4] = EYES_CHADD;
        bytes32 newHash = keccak256(abi.encodePacked(newSlots[0], newSlots[1], newSlots[2], newSlots[3], newSlots[4], newSlots[5], newSlots[6], newSlots[7], newSlots[8], newSlots[9]));

        bytes memory sig = _signSwap(1, 4, EYES_CHADD, newHash, user1, block.timestamp + 1 hours, 0);

        vm.startPrank(user1);
        equipment.setApprovalForAll(address(manager), true);
        manager.swap(1, 4, EYES_CHADD, newHash, sig, block.timestamp + 1 hours, 0);
        vm.stopPrank();

        assertEq(manager.getSlot(1, 4), EYES_CHADD);
        assertEq(equipment.balanceOf(user1, EYES_ENTENCE), 1);
        assertEq(equipment.balanceOf(user1, EYES_CHADD), 0);
        assertEq(equipment.balanceOf(address(manager), EYES_CHADD), 1);
    }

    function test_SwapOptionalSlot() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 1);
        _mintTraitToUser(user1, HAT_WIZZARD, 1);
        _enableClaims();

        uint256[10] memory newSlots = slots;
        newSlots[7] = HAT_WIZZARD;
        bytes32 newHash = keccak256(abi.encodePacked(newSlots[0], newSlots[1], newSlots[2], newSlots[3], newSlots[4], newSlots[5], newSlots[6], newSlots[7], newSlots[8], newSlots[9]));

        bytes memory sig = _signSwap(1, 7, HAT_WIZZARD, newHash, user1, block.timestamp + 1 hours, 0);

        vm.startPrank(user1);
        equipment.setApprovalForAll(address(manager), true);
        manager.swap(1, 7, HAT_WIZZARD, newHash, sig, block.timestamp + 1 hours, 0);
        vm.stopPrank();

        assertEq(manager.getSlot(1, 7), HAT_WIZZARD);
        assertEq(equipment.balanceOf(user1, HAT_PARTI), 1);
    }

    // ──────── Combo Uniqueness Tests ────────

    function test_ComboUniquenessBlocksDuplicate() public {
        // Seed two tokens with similar combos, differing only in hat
        uint256[10] memory slots1 = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        uint256[10] memory slots2 = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_WIZZARD, uint256(0), uint256(0)];

        bytes32 hash1 = keccak256(abi.encodePacked(slots1[0], slots1[1], slots1[2], slots1[3], slots1[4], slots1[5], slots1[6], slots1[7], slots1[8], slots1[9]));
        bytes32 hash2 = keccak256(abi.encodePacked(slots2[0], slots2[1], slots2[2], slots2[3], slots2[4], slots2[5], slots2[6], slots2[7], slots2[8], slots2[9]));

        _seedToken(1, slots1, hash1);
        _seedToken(2, slots2, hash2);
        _mintTraitToManager(HAT_PARTI, 1);
        _mintTraitToManager(HAT_WIZZARD, 1);
        _enableClaims();

        // Token 1 unequips hat → combo becomes [BG_BLU, BOD_DERK, 0, 0, EYES, MOUF, 0, 0, 0, 0]
        uint256[10] memory emptyHatSlots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), uint256(0), uint256(0), uint256(0)];
        bytes32 emptyHatHash = keccak256(abi.encodePacked(emptyHatSlots[0], emptyHatSlots[1], emptyHatSlots[2], emptyHatSlots[3], emptyHatSlots[4], emptyHatSlots[5], emptyHatSlots[6], emptyHatSlots[7], emptyHatSlots[8], emptyHatSlots[9]));

        bytes memory sig1 = _signUnequip(1, 7, emptyHatHash, user1, block.timestamp + 1 hours, 0);
        vm.prank(user1);
        manager.unequip(1, 7, emptyHatHash, sig1, block.timestamp + 1 hours, 0);

        // Token 2 tries to unequip hat → same resulting combo → should revert
        bytes memory sig2 = _signUnequip(2, 7, emptyHatHash, user2, block.timestamp + 1 hours, 1);
        vm.prank(user2);
        vm.expectRevert("Combo taken");
        manager.unequip(2, 7, emptyHatHash, sig2, block.timestamp + 1 hours, 1);
    }

    // ──────── Signature Tests ────────

    function test_SignatureReplayReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 2);
        _enableClaims();

        uint256[10] memory newSlots = slots;
        newSlots[7] = 0;
        bytes32 newHash = keccak256(abi.encodePacked(newSlots[0], newSlots[1], newSlots[2], newSlots[3], newSlots[4], newSlots[5], newSlots[6], newSlots[7], newSlots[8], newSlots[9]));

        bytes memory sig = _signUnequip(1, 7, newHash, user1, block.timestamp + 1 hours, 0);

        vm.prank(user1);
        manager.unequip(1, 7, newHash, sig, block.timestamp + 1 hours, 0);

        // Re-seed hat to try again with same signature
        vm.startPrank(deployer);
        uint256[] memory tids = new uint256[](1);
        tids[0] = 1;
        uint256[10][] memory tslots = new uint256[10][](1);
        tslots[0] = slots;
        manager.seedEquipment(tids, tslots);
        vm.stopPrank();

        vm.prank(user1);
        vm.expectRevert("Signature used");
        manager.unequip(1, 7, newHash, sig, block.timestamp + 1 hours, 0);
    }

    function test_ExpiredDeadlineReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 1);
        _enableClaims();

        uint256 pastDeadline = block.timestamp - 1;
        bytes32 fakeHash = keccak256("fake");
        bytes memory sig = _signUnequip(1, 7, fakeHash, user1, pastDeadline, 0);

        vm.prank(user1);
        vm.expectRevert("Expired");
        manager.unequip(1, 7, fakeHash, sig, pastDeadline, 0);
    }

    function test_InvalidSignerReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 1);
        _enableClaims();

        bytes32 fakeHash = keccak256("fake");

        // Sign with wrong key
        uint256 wrongPk = 0xDEAD;
        bytes32 structHash = keccak256(abi.encode(
            manager.UNEQUIP_TYPEHASH(), uint256(1), uint256(7), fakeHash, user1, block.timestamp + 1 hours, uint256(0)
        ));
        bytes32 digest = _getDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(user1);
        vm.expectRevert("Invalid signer");
        manager.unequip(1, 7, fakeHash, badSig, block.timestamp + 1 hours, 0);
    }

    function test_ClaimsDisabledReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 1);
        // NOT enabling claims

        bytes32 fakeHash = keccak256("fake");
        bytes memory sig = _signUnequip(1, 7, fakeHash, user1, block.timestamp + 1 hours, 0);

        vm.prank(user1);
        vm.expectRevert("Not enabled");
        manager.unequip(1, 7, fakeHash, sig, block.timestamp + 1 hours, 0);
    }

    // ──────── Pre-mint Supply Test ────────

    function test_PreMintSupplyToManager() public {
        uint256[] memory ids = new uint256[](3);
        ids[0] = HAT_PARTI;
        ids[1] = HAT_WIZZARD;
        ids[2] = BG_BLU;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 200;
        amounts[1] = 50;
        amounts[2] = 500;

        vm.prank(deployer);
        equipment.mintBatch(address(manager), ids, amounts);

        assertEq(equipment.balanceOf(address(manager), HAT_PARTI), 200);
        assertEq(equipment.balanceOf(address(manager), HAT_WIZZARD), 50);
        assertEq(equipment.balanceOf(address(manager), BG_BLU), 500);
    }

    // ──────── Batch Modify Tests ────────

    function _signBatchModify(
        uint256 tokenId,
        uint256[] memory slots,
        uint256[] memory newTraitIds,
        bytes32 newComboHash,
        address caller,
        uint256 deadline,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            manager.BATCH_MODIFY_TYPEHASH(),
            tokenId,
            keccak256(abi.encodePacked(slots)),
            keccak256(abi.encodePacked(newTraitIds)),
            newComboHash,
            caller,
            deadline,
            nonce
        ));
        bytes32 digest = _getDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_BatchModifyMultipleSlots() public {
        // Start: hat=PARTI, eyes=ENTENCE, cloth=empty
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 1);
        _mintTraitToManager(EYES_ENTENCE, 1);
        _mintTraitToUser(user1, HAT_WIZZARD, 1);
        _mintTraitToUser(user1, EYES_CHADD, 1);
        _mintTraitToUser(user1, CLOTH_FSHERT, 1);
        _enableClaims();

        // Batch: swap hat (PARTI->WIZZARD), swap eyes (ENTENCE->CHADD), equip cloth (0->FSHERT)
        uint256[] memory modSlots = new uint256[](3);
        modSlots[0] = 7; // hat
        modSlots[1] = 4; // eyes
        modSlots[2] = 2; // cloth

        uint256[] memory modTraits = new uint256[](3);
        modTraits[0] = HAT_WIZZARD;
        modTraits[1] = EYES_CHADD;
        modTraits[2] = CLOTH_FSHERT;

        // Compute final combo
        uint256[10] memory finalSlots = [BG_BLU, BOD_DERK, CLOTH_FSHERT, uint256(0), EYES_CHADD, MOUF_MEEH, uint256(0), HAT_WIZZARD, uint256(0), uint256(0)];
        bytes32 newHash = keccak256(abi.encodePacked(finalSlots[0], finalSlots[1], finalSlots[2], finalSlots[3], finalSlots[4], finalSlots[5], finalSlots[6], finalSlots[7], finalSlots[8], finalSlots[9]));

        bytes memory sig = _signBatchModify(1, modSlots, modTraits, newHash, user1, block.timestamp + 1 hours, 0);

        vm.startPrank(user1);
        equipment.setApprovalForAll(address(manager), true);
        manager.batchModify(1, modSlots, modTraits, newHash, sig, block.timestamp + 1 hours, 0);
        vm.stopPrank();

        // Verify final state
        assertEq(manager.getSlot(1, 7), HAT_WIZZARD);
        assertEq(manager.getSlot(1, 4), EYES_CHADD);
        assertEq(manager.getSlot(1, 2), CLOTH_FSHERT);

        // Old traits returned to user
        assertEq(equipment.balanceOf(user1, HAT_PARTI), 1);
        assertEq(equipment.balanceOf(user1, EYES_ENTENCE), 1);

        // New traits escrowed
        assertEq(equipment.balanceOf(address(manager), HAT_WIZZARD), 1);
        assertEq(equipment.balanceOf(address(manager), EYES_CHADD), 1);
        assertEq(equipment.balanceOf(address(manager), CLOTH_FSHERT), 1);

        // Combo updated
        assertEq(manager.comboToToken(newHash), 1);
    }

    function test_BatchModifyUnequipInBatch() public {
        // Start with hat + cloth equipped
        uint256[10] memory slots = [BG_BLU, BOD_DERK, CLOTH_FSHERT, uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 1);
        _mintTraitToManager(CLOTH_FSHERT, 1);
        _enableClaims();

        // Batch: unequip hat (7->0) + unequip cloth (2->0)
        uint256[] memory modSlots = new uint256[](2);
        modSlots[0] = 7;
        modSlots[1] = 2;
        uint256[] memory modTraits = new uint256[](2);
        modTraits[0] = 0; // unequip
        modTraits[1] = 0; // unequip

        uint256[10] memory finalSlots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), uint256(0), uint256(0), uint256(0)];
        bytes32 newHash = keccak256(abi.encodePacked(finalSlots[0], finalSlots[1], finalSlots[2], finalSlots[3], finalSlots[4], finalSlots[5], finalSlots[6], finalSlots[7], finalSlots[8], finalSlots[9]));

        bytes memory sig = _signBatchModify(1, modSlots, modTraits, newHash, user1, block.timestamp + 1 hours, 0);

        vm.prank(user1);
        manager.batchModify(1, modSlots, modTraits, newHash, sig, block.timestamp + 1 hours, 0);

        assertEq(manager.getSlot(1, 7), 0);
        assertEq(manager.getSlot(1, 2), 0);
        assertEq(equipment.balanceOf(user1, HAT_PARTI), 1);
        assertEq(equipment.balanceOf(user1, CLOTH_FSHERT), 1);
    }

    function test_BatchModifyRequiredSlotUnequipReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _enableClaims();

        // Try to unequip eyes (required slot 4) in batch
        uint256[] memory modSlots = new uint256[](1);
        modSlots[0] = 4;
        uint256[] memory modTraits = new uint256[](1);
        modTraits[0] = 0;

        bytes32 fakeHash = keccak256("fake");
        bytes memory sig = _signBatchModify(1, modSlots, modTraits, fakeHash, user1, block.timestamp + 1 hours, 0);

        vm.prank(user1);
        vm.expectRevert("Required slot");
        manager.batchModify(1, modSlots, modTraits, fakeHash, sig, block.timestamp + 1 hours, 0);
    }

    // ──────── Edge Case Tests ────────

    function test_SwapEmptySlotReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), uint256(0), uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToUser(user1, HAT_PARTI, 1);
        _enableClaims();

        bytes32 fakeHash = keccak256("fake");
        bytes memory sig = _signSwap(1, 7, HAT_PARTI, fakeHash, user1, block.timestamp + 1 hours, 0);

        vm.startPrank(user1);
        equipment.setApprovalForAll(address(manager), true);
        vm.expectRevert("Slot empty");
        manager.swap(1, 7, HAT_PARTI, fakeHash, sig, block.timestamp + 1 hours, 0);
        vm.stopPrank();
    }

    function test_EquipZeroTraitIdReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), uint256(0), uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _enableClaims();

        bytes32 fakeHash = keccak256("fake");
        bytes memory sig = _signEquip(1, 7, 0, fakeHash, user1, block.timestamp + 1 hours, 0);

        vm.prank(user1);
        vm.expectRevert("Invalid trait");
        manager.equip(1, 7, 0, fakeHash, sig, block.timestamp + 1 hours, 0);
    }

    function test_SeedZeroComboHashReverts() public {
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = bytes32(0);

        vm.prank(deployer);
        vm.expectRevert("Invalid combo hash");
        manager.seedComboHashes(tokenIds, hashes);
    }

    function test_SeedDuplicateComboHashReverts() public {
        bytes32 hash = keccak256("combo");

        uint256[] memory ids1 = new uint256[](1);
        ids1[0] = 1;
        bytes32[] memory hashes1 = new bytes32[](1);
        hashes1[0] = hash;

        vm.prank(deployer);
        manager.seedComboHashes(ids1, hashes1);

        uint256[] memory ids2 = new uint256[](1);
        ids2[0] = 2;
        bytes32[] memory hashes2 = new bytes32[](1);
        hashes2[0] = hash;

        vm.prank(deployer);
        vm.expectRevert("Duplicate combo hash");
        manager.seedComboHashes(ids2, hashes2);
    }

    function test_ZeroComboHashInUpdateReverts() public {
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 oldHash = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, oldHash);
        _mintTraitToManager(HAT_PARTI, 1);
        _enableClaims();

        bytes memory sig = _signUnequip(1, 7, bytes32(0), user1, block.timestamp + 1 hours, 0);

        vm.prank(user1);
        vm.expectRevert("Invalid combo hash");
        manager.unequip(1, 7, bytes32(0), sig, block.timestamp + 1 hours, 0);
    }

    // ──────── Full Flow Test ────────

    function test_FullUnequipEquipCycle() public {
        // Setup: seed token with hat, pre-mint hat to manager
        uint256[10] memory slots = [BG_BLU, BOD_DERK, uint256(0), uint256(0), EYES_ENTENCE, MOUF_MEEH, uint256(0), HAT_PARTI, uint256(0), uint256(0)];
        bytes32 hash1 = keccak256(abi.encodePacked(slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7], slots[8], slots[9]));

        _seedToken(1, slots, hash1);
        _mintTraitToManager(HAT_PARTI, 1);
        _enableClaims();

        // Step 1: Unequip hat
        uint256[10] memory noHatSlots = slots;
        noHatSlots[7] = 0;
        bytes32 noHatHash = keccak256(abi.encodePacked(noHatSlots[0], noHatSlots[1], noHatSlots[2], noHatSlots[3], noHatSlots[4], noHatSlots[5], noHatSlots[6], noHatSlots[7], noHatSlots[8], noHatSlots[9]));

        bytes memory sig1 = _signUnequip(1, 7, noHatHash, user1, block.timestamp + 1 hours, 0);
        vm.prank(user1);
        manager.unequip(1, 7, noHatHash, sig1, block.timestamp + 1 hours, 0);

        assertEq(equipment.balanceOf(user1, HAT_PARTI), 1);
        assertEq(manager.getSlot(1, 7), 0);

        // Step 2: Re-equip the same hat
        bytes memory sig2 = _signEquip(1, 7, HAT_PARTI, hash1, user1, block.timestamp + 1 hours, 1);

        vm.startPrank(user1);
        equipment.setApprovalForAll(address(manager), true);
        manager.equip(1, 7, HAT_PARTI, hash1, sig2, block.timestamp + 1 hours, 1);
        vm.stopPrank();

        assertEq(equipment.balanceOf(user1, HAT_PARTI), 0);
        assertEq(manager.getSlot(1, 7), HAT_PARTI);
        assertEq(manager.comboToToken(hash1), 1);
    }
}
