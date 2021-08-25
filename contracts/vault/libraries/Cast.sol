// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../../token/interfaces/sIERC20.sol";

/**
 * @title Cast
 * @dev - Enables casting between sERC1155 token types ids and sERC20 addresses.
 *      - Enables casting from bytes32 to string.
 */
library Cast {
    function id(address _sERC20) internal pure returns (uint256) {
        return uint256(uint160(_sERC20));
    }

    function id(sIERC20 _sERC20) internal pure returns (uint256) {
        return uint256(uint160(address(_sERC20)));
    }

    function sERC20(uint256 _id) internal pure returns (sIERC20) {
        return sIERC20(address(uint160(_id)));
    }

    function toString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while (i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}
