// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../token/interfaces/sIERC20.sol";

contract MarketMock {
    function twapOf(
        sIERC20 /*sERC20*/
    ) external pure returns (uint256) {
        return 1e16;
    }
}
