// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {SavantEquipment} from "../src/SavantEquipment.sol";

contract SavantEquipmentTest is Test {
    SavantEquipment public equipment;

    address deployer = address(0xA1);
    address minter = address(0xBACE);
    address user = address(0xCAFE);

    function setUp() public {
        vm.startPrank(deployer);
        equipment = new SavantEquipment("https://imcs.world/api/traits/{id}");
        equipment.setMinter(minter, true);
        vm.stopPrank();
    }

    function test_MinterCanMint() public {
        vm.prank(minter);
        equipment.mint(user, 7005, 10);
        assertEq(equipment.balanceOf(user, 7005), 10);
        assertEq(equipment.totalSupply(7005), 10);
    }

    function test_OwnerCanMint() public {
        vm.prank(deployer);
        equipment.mint(user, 7005, 5);
        assertEq(equipment.balanceOf(user, 7005), 5);
    }

    function test_NonMinterCannotMint() public {
        vm.prank(user);
        vm.expectRevert("Not minter");
        equipment.mint(user, 7005, 1);
    }

    function test_MintBatch() public {
        uint256[] memory ids = new uint256[](3);
        ids[0] = 7005;
        ids[1] = 11;
        ids[2] = 2028;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100;
        amounts[1] = 200;
        amounts[2] = 50;

        vm.prank(minter);
        equipment.mintBatch(user, ids, amounts);

        assertEq(equipment.balanceOf(user, 7005), 100);
        assertEq(equipment.balanceOf(user, 11), 200);
        assertEq(equipment.balanceOf(user, 2028), 50);
    }

    function test_BurnByHolder() public {
        vm.prank(minter);
        equipment.mint(user, 7005, 10);

        vm.prank(user);
        equipment.burn(user, 7005, 3);
        assertEq(equipment.balanceOf(user, 7005), 7);
        assertEq(equipment.totalSupply(7005), 7);
    }

    function test_SetMinterAuth() public {
        vm.prank(deployer);
        equipment.setMinter(address(0xDEAD), true);
        assertTrue(equipment.authorizedMinters(address(0xDEAD)));

        vm.prank(deployer);
        equipment.setMinter(address(0xDEAD), false);
        assertFalse(equipment.authorizedMinters(address(0xDEAD)));
    }

    function test_NonOwnerCannotSetMinter() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        equipment.setMinter(address(0xDEAD), true);
    }

    function test_SetURI() public {
        vm.prank(deployer);
        equipment.setURI("https://new-uri.com/{id}");
    }

    function test_SupplyTracking() public {
        vm.prank(minter);
        equipment.mint(user, 7005, 10);
        assertEq(equipment.totalSupply(7005), 10);
        assertTrue(equipment.exists(7005));
        assertFalse(equipment.exists(9999));
    }

    function test_Transfer() public {
        vm.prank(minter);
        equipment.mint(user, 7005, 10);

        vm.prank(user);
        equipment.safeTransferFrom(user, address(0xBEEF), 7005, 3, "");
        assertEq(equipment.balanceOf(user, 7005), 7);
        assertEq(equipment.balanceOf(address(0xBEEF), 7005), 3);
    }

    // ── Per-token URI ──────────────────────────────────────────────

    function test_UriDefaultsToGlobal() public {
        string memory result = equipment.uri(7005);
        assertEq(result, "https://imcs.world/api/traits/{id}");
    }

    function test_SetTokenURI() public {
        vm.prank(deployer);
        equipment.setTokenURI(7005, "https://arweave.net/abc123");
        assertEq(equipment.uri(7005), "https://arweave.net/abc123");
        // other tokens still use global
        assertEq(equipment.uri(11), "https://imcs.world/api/traits/{id}");
    }

    function test_SetTokenURIBatch() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 7005;
        ids[1] = 2028;
        string[] memory uris = new string[](2);
        uris[0] = "https://arweave.net/aaa";
        uris[1] = "https://arweave.net/bbb";

        vm.prank(deployer);
        equipment.setTokenURIBatch(ids, uris);

        assertEq(equipment.uri(7005), "https://arweave.net/aaa");
        assertEq(equipment.uri(2028), "https://arweave.net/bbb");
    }

    function test_SetTokenURIBatchLengthMismatch() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 7005;
        ids[1] = 2028;
        string[] memory uris = new string[](1);
        uris[0] = "https://arweave.net/aaa";

        vm.prank(deployer);
        vm.expectRevert("Length mismatch");
        equipment.setTokenURIBatch(ids, uris);
    }

    function test_NonOwnerCannotSetTokenURI() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        equipment.setTokenURI(7005, "https://evil.com");
    }

    function test_GlobalURIUpdatePreserversTokenOverrides() public {
        vm.startPrank(deployer);
        equipment.setTokenURI(7005, "https://arweave.net/abc123");
        equipment.setURI("https://new-base.com/{id}");
        vm.stopPrank();

        assertEq(equipment.uri(7005), "https://arweave.net/abc123");
        assertEq(equipment.uri(11), "https://new-base.com/{id}");
    }

    // ── Max supply ─────────────────────────────────────────────────

    function test_MaxSupplyEnforced() public {
        vm.prank(deployer);
        equipment.setMaxSupply(7005, 25);

        vm.prank(minter);
        equipment.mint(user, 7005, 25);
        assertEq(equipment.balanceOf(user, 7005), 25);

        vm.prank(minter);
        vm.expectRevert("Exceeds max supply");
        equipment.mint(user, 7005, 1);
    }

    function test_MaxSupplyZeroMeansUnlimited() public {
        // no maxSupply set = 0 = unlimited
        vm.prank(minter);
        equipment.mint(user, 7005, 10000);
        assertEq(equipment.balanceOf(user, 7005), 10000);
    }

    function test_MaxSupplyEnforcedOnBatch() public {
        vm.prank(deployer);
        equipment.setMaxSupply(7005, 50);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 7005;
        ids[1] = 11;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 51;
        amounts[1] = 100;

        vm.prank(minter);
        vm.expectRevert("Exceeds max supply");
        equipment.mintBatch(user, ids, amounts);
    }

    function test_SetMaxSupplyCannotGoBelowExisting() public {
        vm.prank(minter);
        equipment.mint(user, 7005, 30);

        vm.prank(deployer);
        vm.expectRevert("Below existing supply");
        equipment.setMaxSupply(7005, 20);
    }

    function test_NonOwnerCannotSetMaxSupply() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        equipment.setMaxSupply(7005, 100);
    }

    function test_MintBatchDuplicateIdMaxSupplyEnforced() public {
        vm.prank(deployer);
        equipment.setMaxSupply(7005, 100);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 7005;
        ids[1] = 7005;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 60;
        amounts[1] = 60;

        vm.prank(minter);
        vm.expectRevert("Exceeds max supply");
        equipment.mintBatch(user, ids, amounts);
    }
}
