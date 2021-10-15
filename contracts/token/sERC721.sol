// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "./sIERC721.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract sERC721 is Context, AccessControlEnumerable, ERC721Burnable, ERC721Enumerable, ERC721Pausable, ERC721URIStorage, sIERC721 {
    using Counters for Counters.Counter;

    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");

    Counters.Counter private _tokenIdTracker;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function mint(address to, string memory _tokenURI) external override whenNotPaused returns (uint256) {
        require(hasRole(MINT_ROLE, _msgSender()), "sERC721: must have MINT_ROLE to mint");

        uint256 tokenId = _tokenIdTracker.current();

        _mint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        _tokenIdTracker.increment();

        return tokenId;
    }

    function pause() external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "sERC721: must have DEFAULT_ADMIN_ROLE to pause");

        _pause();
    }

    function unpause() external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "sERC721: must have DEFAULT_ADMIN_ROLE to unpause");

        _unpause();
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC165, AccessControlEnumerable, ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override(IERC721Metadata, ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
}
