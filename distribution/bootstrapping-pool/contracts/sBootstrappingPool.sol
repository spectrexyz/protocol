// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/sIERC20.sol";
import "./balancer/WeightedPool2Tokens.sol";
import "hardhat/console.sol";

contract sBootstrappingPool is WeightedPool2Tokens {
    using FixedPoint for uint256;
    using WeightedPoolUserDataHelpers for bytes;

    sIERC20 internal _sERC20;
    uint256 internal _sERC20MaxWeight;
    uint256 internal _delta;
    bool    internal _sERC20IsToken0;

    uint256 internal constant JOIN_REWARD = 3;

    constructor(
        IVault  vault,
        string  memory name,
        string  memory symbol,
        IERC20  token0,
        IERC20  token1,
        uint256 sERC20MaxWeight,
        uint256 sERC20MinWeight,
        uint256 swapFeePercentage,
        uint256 pauseWindowDuration,
        uint256 bufferPeriodDuration,
        bool    sERC20IsToken0
    )
        Authentication(bytes32(uint256(msg.sender)))
        BalancerPoolToken(name, symbol)
        BasePoolAuthorization(address(0))
        TemporarilyPausable(pauseWindowDuration, bufferPeriodDuration)
        WeightedPool2Tokens()
    {

        // IL FAUT INVERSER L'ORDRE DES POIDS !!!
        // sERC20 COMMENCE AVEC UN GRAND POIDS ET FINIT AVEC UN PETIT !
        _require(sERC20MinWeight >= _MIN_WEIGHT && sERC20MinWeight <= FixedPoint.ONE.sub(_MIN_WEIGHT), Errors.MIN_WEIGHT);

        _require(FixedPoint.ONE.sub(sERC20MaxWeight) >= _MIN_WEIGHT, Errors.MIN_WEIGHT);
        require(sERC20MaxWeight > sERC20MinWeight, "sBootstrappingPool: sERC20 max weigth must be superior to sERC20 min weight");

        _setOracleEnabled(true);
        _setSwapFeePercentage(swapFeePercentage);

        bytes32 poolId = vault.registerPool(IVault.PoolSpecialization.TWO_TOKEN);

        // pass in zero addresses for asset managers
        IERC20[] memory tokens = new IERC20[](2);
        tokens[0]              = token0;
        tokens[1]              = token1;
        vault.registerTokens(poolId, tokens, new address[](2));

        _vault = vault;
        _poolId = poolId;
        _token0 = token0;
        _token1 = token1;
        _sERC20MaxWeight = sERC20MaxWeight;
        _delta = sERC20MaxWeight.sub(sERC20MinWeight);
        _sERC20IsToken0 = sERC20IsToken0;
        _sERC20 = sERC20IsToken0 ? sIERC20(address(token0)) : sIERC20(address(token1));
        _scalingFactor0 = _computeScalingFactor(token0);
        _scalingFactor1 = _computeScalingFactor(token1);

        _updateWeights();
    }

    function pokeWeights() external {
        bool isOpened = totalSupply() > 0;
        uint256 lastChangeBlock;
        uint256[] memory balances;

        if (isOpened) {
            (, balances, lastChangeBlock) = getVault().getPoolTokens(getPoolId());
            _updateOracle(lastChangeBlock, balances[0], balances[1]);
        }

        uint256[] memory weights = _updateWeights();

        if (isOpened) {
            _lastInvariant = WeightedMath._calculateInvariant(weights, balances);
            _cacheInvariantAndSupply();
        }
    }

    function _updateWeights() private returns (uint256[] memory weights){
        uint256 supply = _sERC20.totalSupply();
        uint256 delta = _delta;
        uint256 gamma  = delta * supply;
        require(gamma / delta == supply, "sBootstrappingPool: math overflow");

        uint256 sWeight = _sERC20MaxWeight.sub(gamma / _sERC20.cap()); // cap is always > 0
        uint256 eWeight = FixedPoint.ONE.sub(sWeight);
 console.log("sWeight: %s", sWeight);
            console.log("eWeight: %s", eWeight);
        weights = new uint256[](2);

        if (_sERC20IsToken0) {
            _normalizedWeight0 = sWeight;
            _normalizedWeight1 = eWeight;
            weights[0] = sWeight;
            weights[1] = eWeight;
        } else {
            _normalizedWeight0 = eWeight;
            _normalizedWeight1 = sWeight;
            weights[0] = eWeight;
            weights[1] = sWeight;
        }

        if (sWeight >= eWeight) {
            _maxWeightTokenIndex = _sERC20IsToken0 ? 0 : 1;
        } else {
            _maxWeightTokenIndex = _sERC20IsToken0 ? 1 : 0;
        }
    }

    function sERC20IsToken0() external view returns (bool) {
        return _sERC20IsToken0;
    }


    function maxWeightTokenIndex() external view returns (uint256) {
        return _maxWeightTokenIndex;
    }

    function _doJoin(
        uint256[] memory balances,
        uint256[] memory normalizedWeights,
        bytes memory userData
    ) internal view override returns (uint256, uint256[] memory) {
        BaseWeightedPool.JoinKind kind;
        uint256 kind_ = abi.decode(userData, (uint256));
        bool isReward = kind_ == JOIN_REWARD;
        if (!isReward) kind = BaseWeightedPool.JoinKind(kind_);

        if (isReward) {
            uint256[] memory amountsIn;
            (, amountsIn) = abi.decode(userData, (uint256, uint256[]));
            return (0, amountsIn);
        } else {
            if (kind == BaseWeightedPool.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT) {
                return _joinExactTokensInForBPTOut(balances, normalizedWeights, userData);
            } else if (kind == BaseWeightedPool.JoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT) {
                return _joinTokenInForExactBPTOut(balances, normalizedWeights, userData);
            } else {
                _revert(Errors.UNHANDLED_JOIN_KIND);
            }
        }
    }
}