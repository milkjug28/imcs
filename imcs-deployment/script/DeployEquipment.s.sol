// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console} from "forge-std/Script.sol";
import {SavantEquipment} from "../src/SavantEquipment.sol";
import {SavantEquipManager} from "../src/SavantEquipManager.sol";

// Deploys the cross-chain trait equip system (Base).
//   1. SavantEquipment (ERC-1155)
//   2. SavantEquipManager (escrow + EIP-712 verifier)
//   3. authorize manager as a minter on equipment
//   4. set the backend authorized signer on the manager
//
// EIP-712 domain MUST stay name="SavantEquipManager" version="1" to match
// imcs-app/src/lib/trait-signer.ts. claimsEnabled stays false until seeding done.
contract DeployEquipment is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address signer = vm.envAddress("AUTHORIZED_SIGNER");
        string memory equipmentUri = vm.envOr(
            "EQUIPMENT_URI",
            string("https://imcs.world/api/traits/metadata/{id}")
        );

        require(signer != address(0), "AUTHORIZED_SIGNER unset");

        vm.startBroadcast(deployerPrivateKey);

        SavantEquipment equipment = new SavantEquipment(equipmentUri);
        SavantEquipManager manager = new SavantEquipManager(
            address(equipment),
            "SavantEquipManager",
            "1"
        );

        equipment.setMinter(address(manager), true);
        manager.setAuthorizedSigner(signer);

        vm.stopBroadcast();

        console.log("SavantEquipment :", address(equipment));
        console.log("SavantEquipManager:", address(manager));
        console.log("authorizedSigner:", signer);
        console.log("equipmentUri    :", equipmentUri);
        console.log("");
        console.log("Set in imcs-app env:");
        console.log("  EQUIPMENT_ADDRESS   =", address(equipment));
        console.log("  EQUIP_MANAGER_ADDRESS=", address(manager));
        console.log("");
        console.log("Next: run scripts/seed-equipment.mjs, then manager.setClaimsEnabled(true)");
    }
}
