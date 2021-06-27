// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/ISERC20.sol";
import "./WeightedPool2Tokens.sol";
import "hardhat/console.sol";

contract SpectralizationBootstrappingPool is WeightedPool2Tokens {
    using FixedPoint for uint256;
    using WeightedPoolUserDataHelpers for bytes;
    using WeightedPool2TokensMiscData for bytes32;

    bool internal /*immutable*/ _sERC20IsToken0;
    ISERC20 internal /*immutable*/ _sERC20;

    uint256 internal /*immutable*/ _normalizedStartWeight;
    uint256 internal /*immutable*/ _normalizedEndWeight;

    constructor(
        IVault vault,
        string memory name,
        string memory symbol,
        IERC20 token0,
        IERC20 token1,
        uint256 normalizedStartWeight,
        uint256 normalizedEndWeight,
        uint256 swapFeePercentage,
        uint256 pauseWindowDuration,
        uint256 bufferPeriodDuration,
        bool sERC20IsToken0
    )
        WeightedPool2Tokens(
          NewPoolParams(
              vault,
              name,
              symbol,
              token0,
              token1,
              _MIN_WEIGHT,
              FixedPoint.ONE.sub(_MIN_WEIGHT),
              swapFeePercentage,
              pauseWindowDuration,
              bufferPeriodDuration,
              true,
              address(0)
          )
        )
    {



        _sERC20IsToken0 = sERC20IsToken0;
        _sERC20 = sERC20IsToken0 ? ISERC20(address(token0)) : ISERC20(address(token1));

        _require(normalizedStartWeight >= _MIN_WEIGHT, Errors.MIN_WEIGHT);
        _require(normalizedEndWeight >= _MIN_WEIGHT, Errors.MIN_WEIGHT); //FixedPoint.ONE.sub(normalizedEndWeight) >= _MIN_WEIGHT
        require(normalizedEndWeight > normalizedStartWeight, "SBP: end weigth must be superior to start weight");

        _normalizedStartWeight = normalizedStartWeight;
        _normalizedEndWeight = normalizedEndWeight;

        // _updateWeights();
    }



    function pokeWeights() external {
        _pokeWeights();
    }

    function _pokeWeights() internal {
        uint256[] memory balances;
        uint256 lastChangeBlock;
        bool isOpened = totalSupply() > 0;

        if (totalSupply() > 0) {
            (, balances, lastChangeBlock) = getVault().getPoolTokens(getPoolId());
            _updateOracle(lastChangeBlock, balances[0], balances[1]);
        }

        uint256[] memory weights = _updateWeights();

        if (totalSupply() > 0) {
            _lastInvariant = WeightedMath._calculateInvariant(weights, balances);
            console.log("Invariant");
           console.log(_lastInvariant);
            console.log("Invariant Log");
            console.log(WeightedOracleMath._fromLowResLog(WeightedOracleMath._toLowResLog(_lastInvariant)));
            console.logInt(WeightedOracleMath._toLowResLog(_lastInvariant));

            _cacheInvariantAndSupply();
        }

    }

    function _updateWeights() private returns (uint256[] memory weights){
      uint256 normalizedStartWeight= _normalizedStartWeight;
      uint256 delta = _normalizedEndWeight - normalizedStartWeight; // > 0
      uint256 supply = _sERC20.totalSupply();
      uint256 gamma = delta * supply;
      require(gamma / delta == supply, "OVERFLOW");
      // console.log(delta);
      // console.log(gamma);

      // uint256 sERC20Weight = _sERC20EndWeight.sub((_sERC20EndWeight.sub(_sERC20StartWeight)).mulUp(_sERC20.totalSupply()).divUp(_sERC20.cap()));
        uint256 sWeight = normalizedStartWeight + (gamma / _sERC20.cap());
        uint256 eWeight = FixedPoint.ONE.sub(sWeight);

        weights = new uint256[](2);

        if (_sERC20IsToken0) {
            _normalizedWeight0 = sWeight;
            _normalizedWeight1 = eWeight;
            // weights.push(sWeight);
            // weights.push(eWeight);

            weights[0] = sWeight;
            weights[1] = eWeight;

        } else {
            _normalizedWeight0 = eWeight;
            _normalizedWeight1 = sWeight;
            weights[1] = sWeight;
            weights[0] = eWeight;
        }

        console.log("== poked ==");
        console.log(supply);
        console.log(_sERC20.totalSupply());

        console.log(gamma);
        console.log(eWeight);
        console.log(_normalizedWeight0);
        console.log("===========");


        if (sWeight >= eWeight) {
            _maxWeightTokenIndex = _sERC20IsToken0 ? 0 : 1;
        } else {
            _maxWeightTokenIndex = _sERC20IsToken0 ? 1 : 0;
        }

        // return _sERC20IsToken0 ? [sWeight, eWeight] : [eWeight, sWeight];

      // _maxWeightTokenIndex = _normalizedWeight0 >= _normalizedWeight1 ? 0 : 1;

        // emit Weights();
    }

    function _weights() internal view returns (uint256 sERC20Weight, uint256 WETHWeight) {
        // we know that :
      // 1. cap > 0 as per the SERC20 contract
      // 2. normalizedEndWeight > normalizedStartWeigth > 0
      // 3. totalSupply <= cap
      // so we don't need to check for overflow excepts for the multiplication
      uint256 normalizedStartWeight= _normalizedStartWeight;
      uint256 delta = _normalizedEndWeight - normalizedStartWeight; // > 0
      uint256 supply = _sERC20.totalSupply();
      uint256 gamma = delta ** supply;
      // require(gamma / delta == supply, "OVERFLOW");
      // console.log(delta);
      // console.log(gamma);

      // uint256 sERC20Weight = _sERC20EndWeight.sub((_sERC20EndWeight.sub(_sERC20StartWeight)).mulUp(_sERC20.totalSupply()).divUp(_sERC20.cap()));
        sERC20Weight = normalizedStartWeight + (gamma / _sERC20.cap());
        WETHWeight = FixedPoint.ONE.sub(sERC20Weight);
    }

    // function onSwap(
    //     SwapRequest memory request,
    //     uint256 balanceTokenIn,
    //     uint256 balanceTokenOut
    // ) external override whenNotPaused onlyVault(request.poolId) returns (uint256) {
    //         bool tokenInIsToken0 = request.tokenIn == _token0;

    //         uint256 scalingFactorTokenIn = _scalingFactor(tokenInIsToken0);
    //         uint256 scalingFactorTokenOut = _scalingFactor(!tokenInIsToken0);

    //         uint256 normalizedWeightIn = _normalizedWeights(tokenInIsToken0);
    //         uint256 normalizedWeightOut = _normalizedWeights(!tokenInIsToken0);

    //         // All token amounts are upscaled.
    //         balanceTokenIn = _upscale(balanceTokenIn, scalingFactorTokenIn);
    //         balanceTokenOut = _upscale(balanceTokenOut, scalingFactorTokenOut);

    //         // Update price oracle with the pre-swap balances
    //         _updateOracle(
    //             request.lastChangeBlock,
    //             tokenInIsToken0 ? balanceTokenIn : balanceTokenOut,
    //             tokenInIsToken0 ? balanceTokenOut : balanceTokenIn
    //         );

    //     if (request.userData[0] == 0x77) {
    //         console.log('MINT');

    //         uint256 _mintFee = 5e16; // 5%

    //         require(_sERC20IsToken0 && tokenInIsToken0 || !_sERC20IsToken0 && !tokenInIsToken0, "SBP: can only mint against ETH");

    //         if (request.kind == IVault.SwapKind.GIVEN_IN) {
    //                             uint256 feeAmount = request.amount.mulUp(getSwapFeePercentage());
    //             request.amount = _upscale(request.amount.sub(feeAmount), scalingFactorTokenIn);

    //             uint256 amountOut = _onSwapGivenIn_(
    //                 request,
    //                 balanceTokenIn,
    //                 balanceTokenOut,
    //                 normalizedWeightIn,
    //                 normalizedWeightOut
    //             );

    //             // what we need is to send part of the ETH received

    //               // ETH -> fixed
    //             // return the amount of tokens exiting the pool: always 
    //             // return the amount of tokens existing the pool: always 0
    //             // amountOut tokens are exiting the Pool, so we round down.
    //             return _downscaleDown(amountOut, scalingFactorTokenOut);
    //         } else {
    //             // return the amount of ETH entering the pool
    //         }
    //     } else {
    //         // does exactly the same as WeightedPool2Tokens.onSwap
        
    //         if (request.kind == IVault.SwapKind.GIVEN_IN) {
    //             // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
    //             // This is amount - fee amount, so we round up (favoring a higher fee amount).
    //             uint256 feeAmount = request.amount.mulUp(getSwapFeePercentage());
    //             request.amount = _upscale(request.amount.sub(feeAmount), scalingFactorTokenIn);

    //             uint256 amountOut = _onSwapGivenIn_(
    //                 request,
    //                 balanceTokenIn,
    //                 balanceTokenOut,
    //                 normalizedWeightIn,
    //                 normalizedWeightOut
    //             );

    //             // amountOut tokens are exiting the Pool, so we round down.
    //             return _downscaleDown(amountOut, scalingFactorTokenOut);
    //         } else {
    //             request.amount = _upscale(request.amount, scalingFactorTokenOut);

    //             uint256 amountIn = _onSwapGivenOut_(
    //                 request,
    //                 balanceTokenIn,
    //                 balanceTokenOut,
    //                 normalizedWeightIn,
    //                 normalizedWeightOut
    //             );

    //             // amountIn tokens are entering the Pool, so we round up.
    //             amountIn = _downscaleUp(amountIn, scalingFactorTokenIn);

    //             // Fees are added after scaling happens, to reduce the complexity of the rounding direction analysis.
    //             // This is amount + fee amount, so we round up (favoring a higher fee amount).
    //             return amountIn.divUp(getSwapFeePercentage().complement());
    //         }

    //           // WeightedPool2Tokens.onSwap(request, balanceTokenIn, balanceTokenOut);
    //     }
    // }
}