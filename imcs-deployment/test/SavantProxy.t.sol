// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {SavantProxy} from "../src/SavantProxy.sol";
import {SavantToken} from "../src/SavantToken.sol";

contract SavantProxyTest is Test {
    SavantProxy public proxy;
    SavantToken public token;

    address public deployer = address(0xA1);
    address public mutator = address(0xBACE);
    address public user = address(0xCAFE);
    address public seaDrop = address(0xDEAD);

    function setUp() public {
        vm.startPrank(deployer);

        address[] memory allowedSeaDrop = new address[](1);
        allowedSeaDrop[0] = seaDrop;
        token = new SavantToken("Savants", "IMCS", allowedSeaDrop);

        proxy = new SavantProxy(address(token));

        // Set max supply so minting works in tests
        token.setMaxSupply(1000);

        // Two-step ownership transfer: token -> proxy
        token.transferOwnership(address(proxy));
        // Proxy accepts via execute (proxy is potentialOwner, execute calls as proxy)
        proxy.execute(abi.encodeWithSignature("acceptOwnership()"));

        vm.stopPrank();

        // Verify proxy owns token
        assertEq(token.owner(), address(proxy));
        // Verify deployer owns proxy
        assertEq(proxy.owner(), deployer);
    }

    function _mint(address to, uint256 qty) internal {
        vm.prank(seaDrop);
        token.mintSeaDrop(to, qty);
    }

    // ========== Ownership Setup ==========

    function test_ProxyOwnsToken() public view {
        assertEq(token.owner(), address(proxy));
    }

    function test_DeployerOwnsProxy() public view {
        assertEq(proxy.owner(), deployer);
    }

    // ========== Mutator Management ==========

    function test_SetMutator() public {
        vm.prank(deployer);
        proxy.setMutator(mutator, true);
        assertTrue(proxy.authorizedMutators(mutator));
    }

    function test_SetMutator_OnlyOwner() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        proxy.setMutator(mutator, true);
    }

    function test_RevokeMutator() public {
        vm.startPrank(deployer);
        proxy.setMutator(mutator, true);
        proxy.setMutator(mutator, false);
        vm.stopPrank();
        assertFalse(proxy.authorizedMutators(mutator));
    }

    // ========== Mutator URI Functions ==========

    function test_SetTokenURI_AsMutator() public {
        _mint(user, 1);

        vm.prank(deployer);
        proxy.setMutator(mutator, true);

        vm.prank(mutator);
        proxy.setTokenURI(1, "ipfs://QmTest123");

        assertEq(token.tokenURI(1), "ipfs://QmTest123");
    }

    function test_SetTokenURI_AsOwner() public {
        _mint(user, 1);

        vm.prank(deployer);
        proxy.setTokenURI(1, "ipfs://QmOwnerSet");

        assertEq(token.tokenURI(1), "ipfs://QmOwnerSet");
    }

    function test_SetTokenURI_Unauthorized() public {
        _mint(user, 1);

        vm.prank(user);
        vm.expectRevert("Not authorized");
        proxy.setTokenURI(1, "ipfs://QmHack");
    }

    function test_BatchSetTokenURI() public {
        _mint(user, 3);

        vm.prank(deployer);
        proxy.setMutator(mutator, true);

        uint256[] memory ids = new uint256[](3);
        string[] memory uris = new string[](3);
        ids[0] = 1; uris[0] = "ipfs://Qm1";
        ids[1] = 2; uris[1] = "ipfs://Qm2";
        ids[2] = 3; uris[2] = "ipfs://Qm3";

        vm.prank(mutator);
        proxy.batchSetTokenURI(ids, uris);

        assertEq(token.tokenURI(1), "ipfs://Qm1");
        assertEq(token.tokenURI(2), "ipfs://Qm2");
        assertEq(token.tokenURI(3), "ipfs://Qm3");
    }

    function test_ClearTokenURI_FallsBackToBaseURI() public {
        _mint(user, 1);

        vm.startPrank(deployer);
        proxy.setBaseURI("https://api.imcs.world/metadata/");
        proxy.setTokenURI(1, "ipfs://QmOverride");
        assertEq(token.tokenURI(1), "ipfs://QmOverride");

        proxy.clearTokenURI(1);
        assertEq(token.tokenURI(1), "https://api.imcs.world/metadata/1");
        vm.stopPrank();
    }

    function test_EmitBatchMetadataUpdate_AsMutator() public {
        vm.prank(deployer);
        proxy.setMutator(mutator, true);

        vm.prank(mutator);
        proxy.emitBatchMetadataUpdate(1, 1000);
        // No revert = success (event emission)
    }

    // ========== Owner-Only Locking ==========

    function test_FreezeUnfreeze() public {
        _mint(user, 1);

        vm.prank(deployer);
        proxy.freezeAll();

        vm.prank(user);
        vm.expectRevert("Token is locked");
        token.transferFrom(user, address(0xBEEF), 1);

        vm.prank(deployer);
        proxy.unfreezeAll();

        vm.prank(user);
        token.transferFrom(user, address(0xBEEF), 1);
        assertEq(token.ownerOf(1), address(0xBEEF));
    }

    function test_LockUnlockToken() public {
        _mint(user, 1);

        vm.prank(deployer);
        proxy.lockToken(1);

        vm.prank(user);
        vm.expectRevert("Token is locked");
        token.transferFrom(user, address(0xBEEF), 1);

        vm.prank(deployer);
        proxy.unlockToken(1);

        vm.prank(user);
        token.transferFrom(user, address(0xBEEF), 1);
        assertEq(token.ownerOf(1), address(0xBEEF));
    }

    function test_BatchLockUnlock() public {
        _mint(user, 3);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 3;

        vm.prank(deployer);
        proxy.batchLockTokens(ids);

        // Token 1 locked
        vm.prank(user);
        vm.expectRevert("Token is locked");
        token.transferFrom(user, address(0xBEEF), 1);

        // Token 2 still transferable
        vm.prank(user);
        token.transferFrom(user, address(0xBEEF), 2);

        // Unlock batch
        vm.prank(deployer);
        proxy.batchUnlockTokens(ids);

        vm.prank(user);
        token.transferFrom(user, address(0xBEEF), 1);
    }

    // ========== Owner-Only Metadata ==========

    function test_SetBaseURI() public {
        _mint(user, 1);

        vm.prank(deployer);
        proxy.setBaseURI("https://api.imcs.world/metadata/");

        assertEq(token.tokenURI(1), "https://api.imcs.world/metadata/1");
    }

    function test_SetContractURI() public {
        vm.prank(deployer);
        proxy.setContractURI("https://api.imcs.world/collection.json");
        // No revert = success
    }

    // ========== Owner-Only Admin Access Control ==========

    function test_AdminFunctions_RevertForNonOwner() public {
        vm.startPrank(user);

        vm.expectRevert("Ownable: caller is not the owner");
        proxy.freezeAll();

        vm.expectRevert("Ownable: caller is not the owner");
        proxy.unfreezeAll();

        vm.expectRevert("Ownable: caller is not the owner");
        proxy.lockToken(1);

        vm.expectRevert("Ownable: caller is not the owner");
        proxy.setBaseURI("hack");

        vm.expectRevert("Ownable: caller is not the owner");
        proxy.transferSavantTokenOwnership(user);

        vm.stopPrank();
    }

    function test_Mutator_CannotCallOwnerFunctions() public {
        vm.prank(deployer);
        proxy.setMutator(mutator, true);

        vm.startPrank(mutator);

        vm.expectRevert("Ownable: caller is not the owner");
        proxy.freezeAll();

        vm.expectRevert("Ownable: caller is not the owner");
        proxy.execute(abi.encodeWithSignature("freezeAll()"));

        vm.expectRevert("Ownable: caller is not the owner");
        proxy.transferSavantTokenOwnership(mutator);

        vm.stopPrank();
    }

    // ========== Escape Hatch ==========

    function test_Execute_ArbitraryCall() public {
        _mint(user, 1);

        vm.prank(deployer);
        proxy.execute(
            abi.encodeWithSignature(
                "setTokenURI(uint256,string)",
                uint256(1),
                "ipfs://QmEscapeHatch"
            )
        );

        assertEq(token.tokenURI(1), "ipfs://QmEscapeHatch");
    }

    function test_Execute_BlocksRenounceOwnership() public {
        vm.prank(deployer);
        vm.expectRevert("renounceOwnership blocked");
        proxy.execute(abi.encodeWithSignature("renounceOwnership()"));

        // Proxy still owns token
        assertEq(token.owner(), address(proxy));
    }

    function test_Execute_OnlyOwner() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        proxy.execute(abi.encodeWithSignature("freezeAll()"));
    }

    // ========== Ownership Chain ==========

    function test_TransferSavantTokenOwnership() public {
        address newOwner = address(0x5678);

        vm.prank(deployer);
        proxy.transferSavantTokenOwnership(newOwner);

        // TwoStepOwnable: newOwner must accept
        vm.prank(newOwner);
        token.acceptOwnership();
        assertEq(token.owner(), newOwner);
    }

    function test_TransferProxyOwnership() public {
        address newProxyOwner = address(0x1234);

        vm.prank(deployer);
        proxy.transferOwnership(newProxyOwner);
        assertEq(proxy.owner(), newProxyOwner);
    }

    function test_CancelSavantTokenOwnershipTransfer() public {
        vm.startPrank(deployer);
        proxy.transferSavantTokenOwnership(address(0x9999));
        proxy.cancelSavantTokenOwnershipTransfer();
        vm.stopPrank();

        // Proxy still owns token
        assertEq(token.owner(), address(proxy));
    }

    // ========== Per-Token URI Override Priority ==========

    function test_PerTokenURI_OverridesBaseURI() public {
        _mint(user, 2);

        vm.startPrank(deployer);
        proxy.setBaseURI("https://base.imcs.world/");
        proxy.setTokenURI(1, "ipfs://QmCustom");
        vm.stopPrank();

        // Token 1: per-token override
        assertEq(token.tokenURI(1), "ipfs://QmCustom");
        // Token 2: falls back to baseURI
        assertEq(token.tokenURI(2), "https://base.imcs.world/2");
    }
}
