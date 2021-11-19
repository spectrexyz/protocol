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

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract ERC1155ReceiverMock is IERC1155Receiver {
    bytes4 private _receiveValue;
    bool private _receiveReverts;
    bytes4 private _batchReceiveValue;
    bool private _batchReceiveReverts;

    event Received(address operator, address from, uint256 id, uint256 value);
    event BatchReceived(address operator, address from, uint256[] ids, uint256[] values, bytes data);

    constructor(
        bytes4 receiveValue,
        bool receiveReverts,
        bytes4 batchReceiveValue,
        bool batchReceiveReverts
    ) {
        _receiveValue = receiveValue;
        _receiveReverts = receiveReverts;
        _batchReceiveValue = batchReceiveValue;
        _batchReceiveReverts = batchReceiveReverts;
    }

    function supportsInterface(bytes4 interfaceId) public pure override(IERC165) returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IERC1155Receiver).interfaceId;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata /*data*/
    ) external override returns (bytes4) {
        require(!_receiveReverts, "ERC1155ReceiverMock: reverting on receive");
        emit Received(operator, from, id, value);

        return _receiveValue;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        require(!_batchReceiveReverts, "ERC1155ReceiverMock: reverting on batch receive");
        emit BatchReceived(operator, from, ids, values, data);
        return _batchReceiveValue;
    }
}
