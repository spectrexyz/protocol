// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface sIERC20 {
    function totalSupply() external returns (uint256);
    function cap() external returns (uint256);
}
