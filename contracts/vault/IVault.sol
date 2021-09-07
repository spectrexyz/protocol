// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../token/sIERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IVault is IERC1155, IERC1155MetadataURI, IERC721Receiver {
    enum SpectreState {
        Null,
        Locked,
        Unlocked
    }

    struct Spectre {
        SpectreState state;
        address collection;
        uint256 tokenId;
        address guardian; // on peut remplacer par broker
    }

    function spectralize(
        address collection,
        uint256 tokenId,
        string memory name,
        string memory symbol,
        uint256 cap,
        address admin,
        address guardian
    ) external returns (uint256 id);

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

    function updateUnavailableURI(string memory unavailableURI_) external;

    function updateUnlockedURI(string memory unlockedURI_) external;

    function onERC20Transferred(
        address from,
        address to,
        uint256 amount
    ) external;

    function sERC20Base() external view returns (address);

    function unavailableURI() external view returns (string memory);

    function unlockedURI() external view returns (string memory);

    function isLocked(address collection, uint256 tokenId) external view returns (bool);

    function lockOf(address collection, uint256 tokenId) external view returns (uint256);

    function spectreOf(uint256 id) external view returns (Spectre memory);

    function spectreOf(address sERC20) external view returns (Spectre memory);

    function sERC20Of(uint256 id) external pure returns (sIERC20);
}