// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console} from "forge-std/Script.sol";
import {SavantPack} from "../src/SavantPack.sol";
import {SavantEquipment} from "../src/SavantEquipment.sol";

// Deploys the card-pack system on top of an existing SavantEquipment deployment.
//   1. SavantPack (VRF v2.5 consumer)
//   2. authorize pack as a minter on equipment (deployer must be equipment owner)
//   3. set booster ladder (+5/+10/+15/+25 weighted 10/7/3/1) and 80% trait chance (default)
//   4. open sale at PACK_PRICE
//
// MANUAL STEPS REQUIRED (cannot be scripted - need the live contract address + LINK):
//   a. Create a VRF v2.5 subscription at https://vrf.chain.link (Base Sepolia), fund with LINK.
//      Put the subscription id in env VRF_SUB_ID before running this.
//   b. After deploy, add the deployed SavantPack as a CONSUMER on that subscription.
//   c. Seed the pool once new trait token ids exist:
//        pack.seedPool(traitTokenIds, amounts)  +  equipment.setMaxSupply per id
//   d. Airdrop / sell packs.
//
// Env:
//   SIGNER_PRIVATE_KEY deployer = equipment owner (the signer wallet, NOT the dev
//                      deployer). Must own SavantEquipment so setMinter succeeds,
//                      and becomes the SavantPack owner (seedPool/airdrop/setSale).
//   EQUIPMENT_ADDRESS  deployed SavantEquipment
//   VRF_SUB_ID         Chainlink VRF v2.5 subscription id (uint256)
//   PACK_TOKEN_ID      1155 id used for the sealed pack token (e.g. 999000)
//   PACK_PRICE         wei price per pack for buyPack (0 to keep sale paused-ish)
//   VRF_COORDINATOR    default = Base Sepolia 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE
//   VRF_KEY_HASH       default = Base Sepolia 30 gwei lane
contract DeployPack is Script {
    // Base Sepolia (84532) VRF v2.5 defaults
    address constant BASE_SEPOLIA_COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    bytes32 constant BASE_SEPOLIA_KEY_HASH_30GWEI =
        0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("SIGNER_PRIVATE_KEY");
        address equipmentAddr = vm.envAddress("EQUIPMENT_ADDRESS");
        uint256 subId = vm.envUint("VRF_SUB_ID");
        uint256 packTokenId = vm.envOr("PACK_TOKEN_ID", uint256(999000));
        uint256 packPrice = vm.envOr("PACK_PRICE", uint256(0));
        address coordinator = vm.envOr("VRF_COORDINATOR", BASE_SEPOLIA_COORDINATOR);
        bytes32 keyHash = vm.envOr("VRF_KEY_HASH", BASE_SEPOLIA_KEY_HASH_30GWEI);

        require(equipmentAddr != address(0), "EQUIPMENT_ADDRESS unset");
        require(subId != 0, "VRF_SUB_ID unset");

        vm.startBroadcast(deployerPrivateKey);

        SavantPack pack = new SavantPack(coordinator, equipmentAddr, packTokenId, keyHash, subId);

        // authorize pack to mint traits + pack tokens on equipment
        SavantEquipment(equipmentAddr).setMinter(address(pack), true);

        // booster ladder
        uint256[] memory amts = new uint256[](4);
        amts[0] = 5; amts[1] = 10; amts[2] = 15; amts[3] = 25;
        uint256[] memory wts = new uint256[](4);
        wts[0] = 10; wts[1] = 7; wts[2] = 3; wts[3] = 1;
        pack.setBoosterTiers(amts, wts);

        pack.setSale(packPrice > 0, packPrice);

        vm.stopBroadcast();

        console.log("SavantPack      :", address(pack));
        console.log("equipment       :", equipmentAddr);
        console.log("coordinator     :", coordinator);
        console.log("packTokenId     :", packTokenId);
        console.log("subId           :", subId);
        console.log("");
        console.log("NEXT (manual):");
        console.log("  1. Add this SavantPack as a consumer on VRF sub", subId);
        console.log("  2. pack.seedPool(traitIds, amounts) + equipment.setMaxSupply per id");
        console.log("  3. airdropPacks / open sale");
    }
}
