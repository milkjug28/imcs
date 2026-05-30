// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {SavantPack} from "../src/SavantPack.sol";
import {SavantEquipment} from "../src/SavantEquipment.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

interface IRawConsumer {
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}

/// Minimal VRF coordinator stand-in. Records the consumer per request and lets the
/// test trigger the callback with chosen random words.
contract MockVRFCoordinator {
    uint256 public nextId = 1;
    mapping(uint256 => address) public consumerOf;

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata) external returns (uint256) {
        uint256 id = nextId++;
        consumerOf[id] = msg.sender;
        return id;
    }

    function fulfill(uint256 id, uint256[] calldata words) external {
        IRawConsumer(consumerOf[id]).rawFulfillRandomWords(id, words);
    }
}

contract SavantPackTest is Test {
    SavantEquipment equip;
    MockVRFCoordinator coord;
    SavantPack pack;

    uint256 constant PACK_ID = 999_000;
    uint256 constant TRAIT_A = 5001;
    uint256 constant TRAIT_B = 5002;

    address alice = address(0xA11CE);

    function setUp() public {
        equip = new SavantEquipment("ipfs://base/");
        coord = new MockVRFCoordinator();
        pack = new SavantPack(address(coord), address(equip), PACK_ID, bytes32("kh"), 1);

        equip.setMinter(address(pack), true);

        // booster ladder: +5,+10,+15,+25 weighted 10,7,3,1
        uint256[] memory amts = new uint256[](4);
        amts[0] = 5; amts[1] = 10; amts[2] = 15; amts[3] = 25;
        uint256[] memory wts = new uint256[](4);
        wts[0] = 10; wts[1] = 7; wts[2] = 3; wts[3] = 1;
        pack.setBoosterTiers(amts, wts);

        pack.setSale(true, 0.01 ether);
    }

    function _seed(uint256 a, uint256 b) internal {
        uint256[] memory ids = new uint256[](2);
        ids[0] = TRAIT_A; ids[1] = TRAIT_B;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = a; amounts[1] = b;
        equip.setMaxSupply(TRAIT_A, a);
        equip.setMaxSupply(TRAIT_B, b);
        pack.seedPool(ids, amounts);
    }

    function _giveAndApprove(address who, uint256 n) internal {
        address[] memory to = new address[](1);
        to[0] = who;
        uint256[] memory amt = new uint256[](1);
        amt[0] = n;
        pack.airdropPacks(to, amt);
        vm.prank(who);
        equip.setApprovalForAll(address(pack), true);
    }

    function test_airdrop_burns_pack_on_open() public {
        _seed(50, 50);
        _giveAndApprove(alice, 1);
        assertEq(equip.balanceOf(alice, PACK_ID), 1);

        vm.prank(alice);
        uint256 reqId = pack.openPack();
        assertEq(equip.balanceOf(alice, PACK_ID), 0, "pack burned");

        uint256[] memory words = new uint256[](1);
        words[0] = 123456789;
        coord.fulfill(reqId, words);
    }

    function test_all_traits_decrements_pool_by_three() public {
        _seed(50, 50);
        pack.setTraitChanceBps(10000); // force traits
        _giveAndApprove(alice, 1);

        uint256 before = pack.totalRemaining();
        vm.prank(alice);
        uint256 reqId = pack.openPack();
        uint256[] memory words = new uint256[](1);
        words[0] = 42;
        coord.fulfill(reqId, words);

        assertEq(pack.totalRemaining(), before - 3, "3 traits drawn");
        uint256 got = equip.balanceOf(alice, TRAIT_A) + equip.balanceOf(alice, TRAIT_B);
        assertEq(got, 3, "minted 3 traits");
    }

    function test_all_boosters_leaves_pool_untouched() public {
        _seed(50, 50);
        pack.setTraitChanceBps(0); // force boosters
        _giveAndApprove(alice, 1);

        uint256 before = pack.totalRemaining();
        vm.prank(alice);
        uint256 reqId = pack.openPack();
        uint256[] memory words = new uint256[](1);
        words[0] = 7;
        coord.fulfill(reqId, words);

        assertEq(pack.totalRemaining(), before, "pool untouched");
        assertEq(equip.balanceOf(alice, TRAIT_A) + equip.balanceOf(alice, TRAIT_B), 0, "no traits");
    }

    function test_partial_pool_falls_back_to_booster() public {
        _seed(1, 1); // only 2 traits total
        pack.setTraitChanceBps(10000);
        _giveAndApprove(alice, 1);

        vm.prank(alice);
        uint256 reqId = pack.openPack();
        uint256[] memory words = new uint256[](1);
        words[0] = 99;
        coord.fulfill(reqId, words);

        assertEq(pack.totalRemaining(), 0, "pool drained");
        assertEq(equip.balanceOf(alice, TRAIT_A) + equip.balanceOf(alice, TRAIT_B), 2, "2 traits, 1 booster");
        assertFalse(pack.seasonOpen());
    }

    function test_open_reverts_when_season_closed() public {
        // single-unit pool so one open drains it to zero
        uint256[] memory ids = new uint256[](1);
        ids[0] = TRAIT_A;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        equip.setMaxSupply(TRAIT_A, 1);
        pack.seedPool(ids, amounts);

        pack.setTraitChanceBps(10000);
        _giveAndApprove(alice, 2);

        vm.prank(alice);
        uint256 reqId = pack.openPack();
        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        coord.fulfill(reqId, words);
        assertEq(pack.totalRemaining(), 0);

        vm.prank(alice);
        vm.expectRevert("season closed");
        pack.openPack();
    }

    function test_buy_pack_requires_payment() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert("underpaid");
        pack.buyPack{value: 0.005 ether}(1);

        vm.prank(alice);
        pack.buyPack{value: 0.02 ether}(2);
        assertEq(equip.balanceOf(alice, PACK_ID), 2);
    }

    function test_only_owner_seeds_pool() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = TRAIT_A;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5;
        vm.prank(alice);
        vm.expectRevert();
        pack.seedPool(ids, amounts);
    }

    function test_dud_drops_one_slot() public {
        _seed(50, 50);
        pack.setTraitChanceBps(10000); // force traits so non-dud slots always mint
        pack.setDudChanceBps(10000); // force a dud slot every pack
        _giveAndApprove(alice, 1);

        uint256 before = pack.totalRemaining();
        vm.prank(alice);
        uint256 reqId = pack.openPack();
        uint256[] memory words = new uint256[](1);
        words[0] = 42;
        coord.fulfill(reqId, words);

        // one slot dudded -> only 2 traits drawn
        assertEq(pack.totalRemaining(), before - 2, "2 traits drawn (one slot dudded)");
        assertEq(equip.balanceOf(alice, TRAIT_A) + equip.balanceOf(alice, TRAIT_B), 2, "minted 2 traits");
    }

    function test_open_without_pack_reverts() public {
        _seed(10, 10);
        vm.prank(alice);
        equip.setApprovalForAll(address(pack), true);
        vm.prank(alice);
        vm.expectRevert(); // burn fails, no balance
        pack.openPack();
    }
}
