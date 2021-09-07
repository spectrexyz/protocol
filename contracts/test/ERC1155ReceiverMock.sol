// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract ERC1155ReceiverMock is IERC1155Receiver {
    bytes4 private _receiveValue;
    bool private _receiveReverts;
    bytes4 private _batchReceiveValue;
    bool private _batchReceiveReverts;

    event Received(address operator, address from, uint256 id, uint256 value, bytes data);
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
        bytes calldata data
    ) external override returns (bytes4) {
        require(!_receiveReverts, "ERC1155ReceiverMock: reverting on receive");
        emit Received(operator, from, id, value, data);
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
