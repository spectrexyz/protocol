// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./IPriceOracle.sol";

interface ISpectralizationBootstrappingPool {
    enum JoinKind {
        INIT,
        EXACT_TOKENS_IN_FOR_BPT_OUT,
        TOKEN_IN_FOR_EXACT_BPT_OUT,
        REWARD
    }

    function totalSupply() external view returns (uint256);

    function getTimeWeightedAverage(IPriceOracle.OracleAverageQuery[] memory queries) external view returns (uint256[] memory prices);

    function getLatest(IPriceOracle.Variable variable) external view returns (uint256);

    function getNormalizedWeights() external view returns (uint256[] memory);

    function getPoolId() external view returns (bytes32);

    function sERC20IsToken0() external view returns (bool);
}
