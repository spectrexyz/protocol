// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../token/sIERC20.sol";

contract IssuerMock {
    event Close(sIERC20 indexed sERC20);

    function twapOf(
        sIERC20 /*sERC20*/
    ) external pure returns (uint256) {
        return 2e18; // 2 ETH per sERC20
    }

    function close(sIERC20 sERC20) external {
        emit Close(sERC20);
    }
}
