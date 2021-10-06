// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract ERC721Mock {
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId != 0xffffffff;
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public pure {
        // do nothing
    }

    function ownerOf(uint256) public view returns (address) {
        return address(this);
    }
}
