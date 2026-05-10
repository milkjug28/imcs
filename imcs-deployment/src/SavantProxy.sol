// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISeaDropTokenContractMetadata} from "seadrop/interfaces/ISeaDropTokenContractMetadata.sol";

interface ISavantToken {
    // Token URI
    function setTokenURI(uint256 tokenId, string calldata uri) external;
    function batchSetTokenURI(uint256[] calldata tokenIds, string[] calldata uris) external;
    function clearTokenURI(uint256 tokenId) external;

    // Locking (ERC-5192)
    function freezeAll() external;
    function unfreezeAll() external;
    function lockToken(uint256 tokenId) external;
    function unlockToken(uint256 tokenId) external;
    function batchLockTokens(uint256[] calldata tokenIds) external;
    function batchUnlockTokens(uint256[] calldata tokenIds) external;

    // Metadata
    function setBaseURI(string calldata newBaseURI) external;
    function setContractURI(string calldata newContractURI) external;
    function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) external;
    function setMaxSupply(uint256 newMaxSupply) external;

    // Royalties
    function setRoyaltyInfo(ISeaDropTokenContractMetadata.RoyaltyInfo calldata newInfo) external;
    function setTransferValidator(address newValidator) external;

    // Ownership
    function transferOwnership(address newPotentialOwner) external;
    function cancelOwnershipTransfer() external;
}

/**
 * @title SavantProxy
 * @dev Proxy owner of SavantToken. Provides mutator pattern for
 *      automated URI updates and explicit proxies for admin functions.
 *      Includes execute() escape hatch for any function not explicitly proxied.
 */
contract SavantProxy is Ownable {
    address public immutable savantToken;

    mapping(address => bool) public authorizedMutators;

    event MutatorUpdated(address indexed mutator, bool authorized);

    modifier onlyMutator() {
        require(authorizedMutators[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address _savantToken) {
        savantToken = _savantToken;
    }

    // ========== Mutator Management ==========

    function setMutator(address mutator, bool authorized) external onlyOwner {
        authorizedMutators[mutator] = authorized;
        emit MutatorUpdated(mutator, authorized);
    }

    // ========== Mutator-Accessible (backend automation) ==========

    function setTokenURI(uint256 tokenId, string calldata uri) external onlyMutator {
        ISavantToken(savantToken).setTokenURI(tokenId, uri);
    }

    function batchSetTokenURI(
        uint256[] calldata tokenIds,
        string[] calldata uris
    ) external onlyMutator {
        ISavantToken(savantToken).batchSetTokenURI(tokenIds, uris);
    }

    function clearTokenURI(uint256 tokenId) external onlyMutator {
        ISavantToken(savantToken).clearTokenURI(tokenId);
    }

    function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) external onlyMutator {
        ISavantToken(savantToken).emitBatchMetadataUpdate(fromTokenId, toTokenId);
    }

    // ========== Owner-Only Admin ==========

    // --- Locking ---

    function freezeAll() external onlyOwner {
        ISavantToken(savantToken).freezeAll();
    }

    function unfreezeAll() external onlyOwner {
        ISavantToken(savantToken).unfreezeAll();
    }

    function lockToken(uint256 tokenId) external onlyOwner {
        ISavantToken(savantToken).lockToken(tokenId);
    }

    function unlockToken(uint256 tokenId) external onlyOwner {
        ISavantToken(savantToken).unlockToken(tokenId);
    }

    function batchLockTokens(uint256[] calldata tokenIds) external onlyOwner {
        ISavantToken(savantToken).batchLockTokens(tokenIds);
    }

    function batchUnlockTokens(uint256[] calldata tokenIds) external onlyOwner {
        ISavantToken(savantToken).batchUnlockTokens(tokenIds);
    }

    // --- Metadata ---

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        ISavantToken(savantToken).setBaseURI(newBaseURI);
    }

    function setContractURI(string calldata newContractURI) external onlyOwner {
        ISavantToken(savantToken).setContractURI(newContractURI);
    }

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        ISavantToken(savantToken).setMaxSupply(newMaxSupply);
    }

    // --- Royalties ---

    function setRoyaltyInfo(
        ISeaDropTokenContractMetadata.RoyaltyInfo calldata newInfo
    ) external onlyOwner {
        ISavantToken(savantToken).setRoyaltyInfo(newInfo);
    }

    function setTransferValidator(address newValidator) external onlyOwner {
        ISavantToken(savantToken).setTransferValidator(newValidator);
    }

    // --- SavantToken Ownership ---

    function transferSavantTokenOwnership(address newOwner) external onlyOwner {
        ISavantToken(savantToken).transferOwnership(newOwner);
    }

    function cancelSavantTokenOwnershipTransfer() external onlyOwner {
        ISavantToken(savantToken).cancelOwnershipTransfer();
    }

    // ========== Escape Hatch ==========

    /**
     * @dev Execute arbitrary call to SavantToken. Covers any function
     *      not explicitly proxied (SeaDrop config, future additions, etc).
     *      Owner-only. Cannot be used to call renounceOwnership.
     */
    function execute(bytes calldata data) external onlyOwner returns (bytes memory) {
        // Block renounceOwnership (selector 0x715018a6)
        require(bytes4(data[:4]) != bytes4(0x715018a6), "renounceOwnership blocked");

        (bool success, bytes memory result) = savantToken.call(data);
        require(success, _getRevertMsg(result));
        return result;
    }

    function _getRevertMsg(bytes memory returnData) internal pure returns (string memory) {
        if (returnData.length < 68) return "Call failed";
        assembly {
            returnData := add(returnData, 0x04)
        }
        return abi.decode(returnData, (string));
    }
}
