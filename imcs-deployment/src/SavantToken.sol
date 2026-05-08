// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ERC721SeaDrop} from "seadrop/ERC721SeaDrop.sol";

/**
 * @title SavantToken
 * @dev Imaginary Magic Crypto Savants - SeaDrop-compatible ERC721
 *      with per-token URI override and ERC-5192 locking.
 */
contract SavantToken is ERC721SeaDrop {
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => bool) private _lockedTokens;
    bool public allFrozen;

    // ERC-5192
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    event TokenURIUpdated(uint256 indexed tokenId, string uri);
    event AllFrozen(bool frozen);

    constructor(
        string memory name,
        string memory symbol,
        address[] memory allowedSeaDrop
    ) ERC721SeaDrop(name, symbol, allowedSeaDrop) {}

    // --- ERC-5192 Locking ---

    function freezeAll() external onlyOwner {
        allFrozen = true;
        emit AllFrozen(true);
        uint256 supply = totalSupply();
        for (uint256 i = 1; i <= supply; i++) {
            emit Locked(i);
        }
    }

    function unfreezeAll() external onlyOwner {
        allFrozen = false;
        emit AllFrozen(false);
        uint256 supply = totalSupply();
        for (uint256 i = 1; i <= supply; i++) {
            if (!_lockedTokens[i]) {
                emit Unlocked(i);
            }
        }
    }

    function lockToken(uint256 tokenId) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        _lockedTokens[tokenId] = true;
        emit Locked(tokenId);
    }

    function unlockToken(uint256 tokenId) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        _lockedTokens[tokenId] = false;
        if (!allFrozen) {
            emit Unlocked(tokenId);
        }
    }

    function batchLockTokens(uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _lockedTokens[tokenIds[i]] = true;
            emit Locked(tokenIds[i]);
        }
    }

    function batchUnlockTokens(uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _lockedTokens[tokenIds[i]] = false;
            if (!allFrozen) {
                emit Unlocked(tokenIds[i]);
            }
        }
    }

    function isLocked(uint256 tokenId) external view returns (bool) {
        return allFrozen || _lockedTokens[tokenId];
    }

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal override {
        if (from != address(0)) {
            for (uint256 i = 0; i < quantity; i++) {
                require(
                    !allFrozen && !_lockedTokens[startTokenId + i],
                    "Token is locked"
                );
            }
        }
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }

    // --- ERC-5192 Interface ---

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        // 0xb45a3c0e = ERC-5192
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    // --- Token URI ---

    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        _tokenURIs[tokenId] = uri;
        emit TokenURIUpdated(tokenId, uri);
    }

    function batchSetTokenURI(
        uint256[] calldata tokenIds,
        string[] calldata uris
    ) external onlyOwner {
        require(tokenIds.length == uris.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_exists(tokenIds[i]), "Token does not exist");
            _tokenURIs[tokenIds[i]] = uris[i];
            emit TokenURIUpdated(tokenIds[i], uris[i]);
        }
    }

    function clearTokenURI(uint256 tokenId) external onlyOwner {
        delete _tokenURIs[tokenId];
        emit TokenURIUpdated(tokenId, "");
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (bytes(_tokenURIs[tokenId]).length > 0) {
            return _tokenURIs[tokenId];
        }
        return super.tokenURI(tokenId);
    }
}
