// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAsset {}

interface IPriceOracle {
    enum Variable {
        PAIR_PRICE,
        BPT_PRICE,
        INVARIANT
    }

    struct OracleAccumulatorQuery {
        Variable variable;
        uint256 ago;
    }

    struct OracleAverageQuery {
        Variable variable;
        uint256 secs;
        uint256 ago;
    }

    function getTimeWeightedAverage(OracleAverageQuery[] memory queries) external view returns (uint256[] memory results);

    function getLatest(Variable variable) external view returns (uint256);

    function getLargestSafeQueryWindow() external view returns (uint256);

    function getPastAccumulators(OracleAccumulatorQuery[] memory queries) external view returns (int256[] memory results);
}

interface IBVault {
    struct JoinPoolRequest {
        IAsset[] assets;
        uint256[] maxAmountsIn;
        bytes userData;
        bool fromInternalBalance;
    }

    function getPoolTokens(bytes32 poolId)
        external
        view
        returns (
            IERC20[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        );

    function joinPool(
        bytes32 poolId,
        address sender,
        address recipient,
        JoinPoolRequest memory request
    ) external payable;

    function WETH() external view returns (address);
}
