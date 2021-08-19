// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;

interface sIFlashBuyout {
    function register(address sERC20, address pool, uint256 multiplier, uint256 timeframe) external;
}