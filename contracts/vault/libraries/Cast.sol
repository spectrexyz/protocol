// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import "../../token/sIERC20.sol";

/**
 * @title Cast
 * @dev - Enables casting between ERC1155 token types ids and sERC20 addresses.
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
        uint256 i = 0;
        while (i < 32 && _bytes32[i] != 0) {
            i++;
        }

        bytes memory characters = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            characters[i] = _bytes32[i];
        }

        return string(characters);
    }
}
