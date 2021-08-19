// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IFlashBroker {
    function register(
        address sERC20,
        address pool,
        uint256 multiplier,
        uint256 timelock,
        bool flash
    ) external;
}
