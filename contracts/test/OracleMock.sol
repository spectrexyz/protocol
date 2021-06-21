// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.0;

import "@balancer-labs/v2-pool-weighted/contracts/WeightedOracleMath.sol";

contract OracleMock is WeightedOracleMath {
    function toLowResLog(uint256 value) external pure returns (int256) {
        return WeightedOracleMath._toLowResLog(value);
    }

    function fromLowResLog(int256 value) external pure returns (uint256) {
        return WeightedOracleMath._fromLowResLog(value);
    }

    function calcLogSpotPrice(
        uint256 normalizedWeightA,
        uint256 balanceA,
        uint256 normalizedWeightB,
        uint256 balanceB
    ) external pure returns (int256) {
        return WeightedOracleMath._calcLogSpotPrice(normalizedWeightA, balanceA, normalizedWeightB, balanceB);
    }

    function calcLogBPTPrice(
        uint256 normalizedWeight,
        uint256 balance,
        int256 bptTotalSupplyLn
    ) external pure returns (int256) {
        return WeightedOracleMath._calcLogBPTPrice(normalizedWeight, balance, bptTotalSupplyLn);
    }
}