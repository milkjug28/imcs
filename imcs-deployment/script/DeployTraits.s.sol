// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console} from "forge-std/Script.sol";
import {SavantTraits} from "../src/SavantTraits.sol";

contract DeployTraits is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address savantToken = vm.envAddress("SAVANT_TOKEN_ADDRESS");

        console.log("Deploying SavantTraits");
        console.log("SavantToken:", savantToken);

        vm.startBroadcast(deployerPrivateKey);

        SavantTraits traits = new SavantTraits(savantToken);
        console.log("SavantTraits deployed:", address(traits));

        vm.stopBroadcast();

        console.log("\nNext steps:");
        console.log("1. Set authorized mutators (backend, game contracts)");
        console.log("2. Seed initial trait data if needed");
    }
}
