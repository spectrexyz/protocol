// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

interface sIERC721 is IERC721, IERC721Metadata, IERC721Enumerable {
    function mint(address to, string memory _tokenURI) external returns (uint256);

    function pause() external;

    function unpause() external;
}
