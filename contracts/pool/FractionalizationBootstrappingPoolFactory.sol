// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./FractionalizationBootstrappingPool.sol";
import "@balancer-labs/v2-pool-utils/contracts/factories/BasePoolSplitCodeFactory.sol";
import "@balancer-labs/v2-pool-utils/contracts/factories/FactoryWidePauseWindow.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";

contract FractionalizationBootstrappingPoolFactory is BasePoolSplitCodeFactory, FactoryWidePauseWindow {
    event CreatePool(address pool);

    constructor(IVault vault) BasePoolSplitCodeFactory(vault, type(FractionalizationBootstrappingPool).creationCode) {}

    /**
     * @notice Deploys a new `FractionalizationBootstrappingPool`.
     */
    function create(
        string memory name,
        string memory symbol,
        IERC20 token0,
        IERC20 token1,
        uint256 sMaxNormalizedWeight,
        uint256 sMinNormalizedWeight,
        uint256 swapFeePercentage,
        bool sERC20IsToken0
    ) external returns (address) {
        (uint256 pauseWindowDuration, uint256 bufferPeriodDuration) = getPauseConfiguration();

        FractionalizationBootstrappingPool.NewPoolParams memory params = FractionalizationBootstrappingPool.NewPoolParams({
            vault: getVault(),
            name: name,
            symbol: symbol,
            token0: token0,
            token1: token1,
            sMaxNormalizedWeight: sMaxNormalizedWeight,
            sMinNormalizedWeight: sMinNormalizedWeight,
            swapFeePercentage: swapFeePercentage,
            pauseWindowDuration: pauseWindowDuration,
            bufferPeriodDuration: bufferPeriodDuration,
            sERC20IsToken0: sERC20IsToken0,
            owner: address(0)
        });

        address pool = _create(abi.encode(params));
        emit CreatePool(pool);

        return pool;
    }
}
