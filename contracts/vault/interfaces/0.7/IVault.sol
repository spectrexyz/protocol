// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-0.7/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-0.7/token/ERC1155/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts-0.7/token/ERC721/IERC721Receiver.sol";

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
        address guardian;
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
        address sERC20,
        address recipient,
        bytes calldata data
    ) external;

    function updateUnavailableURI(string memory unavailableURI_) external;

    function updateUnlockedURI(string memory unlockedURI_) external;

    function onSERC20Transferred(
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

    function sERC20Of(uint256 id) external pure returns (address);
}
