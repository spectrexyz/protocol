// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract ERC721SenderMock {
    function supportsInterface(bytes4) public pure returns (bool) {
        return false;
    }

    function onERC721Received(IERC721Receiver to, bytes calldata data) external {
        to.onERC721Received(address(0), address(0), 0, data);
    }
}
