// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./libraries/Spectres.sol";
import "../token/sIERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IVault {
    event Fractionalize(IERC721 indexed collection, uint256 indexed tokenId, uint256 indexed id, sIERC20 sERC20, address broker);
    event Unlock(uint256 indexed id, address recipient);
    event Escape(IERC721 collection, uint256 tokenId, address recipient);

    function fractionalize(
        IERC721 collection,
        uint256 tokenId,
        string memory name,
        string memory symbol,
        uint256 cap,
        address admin,
        address broker
    ) external returns (uint256);

    function unlock(
        uint256 id,
        address recipient,
        bytes calldata data
    ) external;

    function unlock(
        sIERC20 sERC20,
        address recipient,
        bytes calldata data
    ) external;

    function escape(
        IERC721 collection,
        uint256 tokenId,
        address recipient,
        bytes memory data
    ) external;

    function setUnavailableURI(string memory unavailableURI_) external;

    function setUnlockedURI(string memory unlockedURI_) external;

    function onERC20Transferred(
        address from,
        address to,
        uint256 amount
    ) external;

    function sERC20Base() external view returns (address);

    function unavailableURI() external view returns (string memory);

    function unlockedURI() external view returns (string memory);

    function isLocked(IERC721 collection, uint256 tokenId) external view returns (bool);

    function tokenTypeOf(IERC721 collection, uint256 tokenId) external view returns (uint256);

    function spectreOf(uint256 id) external view returns (Spectres.Spectre memory);

    function spectreOf(sIERC20 sERC20) external view returns (Spectres.Spectre memory);

    function sERC20Of(uint256 id) external pure returns (sIERC20);
}
