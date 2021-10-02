// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface sIERC20 {
    function cap() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}
