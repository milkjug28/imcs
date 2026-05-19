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
}
