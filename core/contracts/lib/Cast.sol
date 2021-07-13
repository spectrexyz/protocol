// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../SERC20.sol";

/**
 * @title Cast
 * @notice Library enabling casting between sERC1155 token types ids and sERC20 addresses
 */
library Cast {
    function toId(address sERC20) internal pure returns (uint256) {
        return uint256(uint160(address(sERC20)));
    }

    function toAddress(uint256 id) internal pure returns (address) {
        return address(uint160(id));
    }

    function toSERC20(uint256 id) internal pure returns (SERC20) {
        return SERC20(address(uint160(id)));
    }

    function toString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}
