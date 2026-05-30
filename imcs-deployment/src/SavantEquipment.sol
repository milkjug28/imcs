// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SavantEquipment is ERC1155, ERC1155Supply, ERC1155Burnable, Ownable {
    mapping(address => bool) public authorizedMinters;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => uint256) public maxSupply;

    event MinterUpdated(address indexed minter, bool authorized);
    event MaxSupplySet(uint256 indexed id, uint256 amount);

    modifier onlyMinter() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not minter");
        _;
    }

    constructor(string memory uri_) ERC1155(uri_) {}

    function uri(uint256 id) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[id];
        if (bytes(tokenURI).length > 0) return tokenURI;
        return super.uri(id);
    }

    function setTokenURI(uint256 id, string calldata tokenURI) external onlyOwner {
        _tokenURIs[id] = tokenURI;
        emit URI(tokenURI, id);
    }

    function setTokenURIBatch(uint256[] calldata ids, string[] calldata uris) external onlyOwner {
        require(ids.length == uris.length, "Length mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            _tokenURIs[ids[i]] = uris[i];
            emit URI(uris[i], ids[i]);
        }
    }

    function setMaxSupply(uint256 id, uint256 amount) external onlyOwner {
        require(amount >= totalSupply(id), "Below existing supply");
        maxSupply[id] = amount;
        emit MaxSupplySet(id, amount);
    }

    function setMinter(address minter, bool authorized) external onlyOwner {
        authorizedMinters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    function mint(address to, uint256 id, uint256 amount) external onlyMinter {
        if (maxSupply[id] > 0) {
            require(totalSupply(id) + amount <= maxSupply[id], "Exceeds max supply");
        }
        _mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyMinter {
        for (uint256 i = 0; i < ids.length; i++) {
            if (maxSupply[ids[i]] > 0) {
                uint256 pending = 0;
                for (uint256 j = 0; j < i; j++) {
                    if (ids[j] == ids[i]) pending += amounts[j];
                }
                require(totalSupply(ids[i]) + pending + amounts[i] <= maxSupply[ids[i]], "Exceeds max supply");
            }
        }
        _mintBatch(to, ids, amounts, "");
    }

    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
