// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Script, console} from "forge-std/Script.sol";
import {SavantToken} from "../src/SavantToken.sol";
import {AllowListData, PublicDrop} from "seadrop/lib/SeaDropStructs.sol";

contract DeploySavant is Script {
    address public constant SEADROP = 0x00005EA00Ac477B1030CE78506496e8C2dE24bf5;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        string memory name = vm.envOr("TOKEN_NAME", string("Imaginary Magic Crypto Savants"));
        string memory symbol = vm.envOr("TOKEN_SYMBOL", string("IMCS"));
        uint256 maxSupply = vm.envOr("MAX_SUPPLY", uint256(3000));
        uint256 mintPrice = vm.envOr("MINT_PRICE", uint256(0 ether));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(0));

        console.log("Deploying SavantToken");
        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Max Supply:", maxSupply);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy token
        address[] memory allowedSeaDrop = new address[](1);
        allowedSeaDrop[0] = SEADROP;

        SavantToken token = new SavantToken(name, symbol, allowedSeaDrop);
        console.log("SavantToken deployed:", address(token));

        // Set max supply
        token.setMaxSupply(maxSupply);

        // Configure public drop (initially paused - startTime in future)
        PublicDrop memory publicDrop = PublicDrop({
            mintPrice: uint80(mintPrice),
            startTime: uint48(block.timestamp + 365 days),
            endTime: uint48(block.timestamp + 730 days),
            maxTotalMintableByWallet: 3,
            feeBps: uint16(feeBps),
            restrictFeeRecipients: true
        });
        token.updatePublicDrop(SEADROP, publicDrop);

        // Configure fee recipient
        token.updateAllowedFeeRecipient(SEADROP, feeRecipient, true);

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("Token:", address(token));
        console.log("Owner:", token.owner());
        console.log("\nNext steps:");
        console.log("1. Set baseURI (after IPFS upload)");
        console.log("2. Set merkle roots for allowlist phases");
        console.log("3. Configure phase timing");
        console.log("4. Upload allowlists to OpenSea Studio");
    }
}
