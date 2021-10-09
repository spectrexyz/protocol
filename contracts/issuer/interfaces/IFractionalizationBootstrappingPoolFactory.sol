// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IFractionalizationBootstrappingPoolFactory {
    function create(
        string memory name,
        string memory symbol,
        address token0,
        address token1,
        uint256 sMaxNormalizedWeight,
        uint256 sMinNormalizedWeight,
        uint256 swapFeePercentage,
        bool sERC20IsToken0
    ) external returns (address);
}
