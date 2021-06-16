// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@balancer-labs/v2-solidity-utils/contracts/math/FixedPoint.sol";
import "@balancer-labs/v2-solidity-utils/contracts/helpers/InputHelpers.sol";
import "@balancer-labs/v2-solidity-utils/contracts/helpers/TemporarilyPausable.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/ERC20.sol";

import "@balancer-labs/v2-vault/contracts/interfaces/IMinimalSwapInfoPool.sol";

import "@balancer-labs/v2-pool-utils/contracts/BasePoolAuthorization.sol";
import "@balancer-labs/v2-pool-utils/contracts/BalancerPoolToken.sol";

import "@balancer-labs/v2-pool-weighted/contracts/WeightedMath.sol";
import "@balancer-labs/v2-pool-weighted/contracts/WeightedOracleMath.sol";
import "@balancer-labs/v2-pool-weighted/contracts/WeightedPool2TokensMiscData.sol";
import "@balancer-labs/v2-pool-weighted/contracts/WeightedPoolUserDataHelpers.sol";

import "@balancer-labs/v2-pool-weighted/contracts/WeightedPool2Tokens.sol";


import "@balancer-labs/v2-pool-weighted/contracts/oracle/PoolPriceOracle.sol";
import "@balancer-labs/v2-pool-weighted/contracts/oracle/Buffer.sol";

import "@balancer-labs/v2-pool-weighted/contracts/IPriceOracle.sol";

import "./interfaces/ISERC20.sol";
import "hardhat/console.sol";
contract SpectralizationBootstrappingPool is WeightedPool2Tokens {
    using FixedPoint for uint256;
    using WeightedPoolUserDataHelpers for bytes;
    using WeightedPool2TokensMiscData for bytes32;

    bool internal /*immutable*/ _sERC20IsToken0;
    ISERC20 internal /*immutable*/ _sERC20;

    uint256 internal /*immutable*/ _normalizedStartWeight;
    uint256 internal /*immutable*/ _normalizedEndWeight;

    uint256 private _normalizedWeight0;
    uint256 private _normalizedWeight1;
    uint256 private _maxWeightTokenIndex;
    

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
        _require(normalizedEndWeight >= _MIN_WEIGHT, Errors.MIN_WEIGHT);
        require(normalizedEndWeight > normalizedStartWeight, "SBP: end weigth must be superior to start weight");

        _normalizedStartWeight = normalizedStartWeight;
        _normalizedEndWeight = normalizedEndWeight;

        _pokeWeights();
        // find the token index of the maximum weight
        // _maxWeightTokenIndex = params.normalizedWeight0 >= params.normalizedWeight1 ? 0 : 1; // <=== non ! on le bouge dans _ppokeWeight
    }

    function update(uint256 weight) external {
        _normalizedWeight0 = weight;
    }

    function weight() external view returns (uint256) {
      return _normalizedWeight0;
    }

    function pokeWeights() internal {
        _pokeWeights();
    }

    function _pokeWeights() internal {
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
      console.log(delta);
      console.log(gamma);

      // uint256 sERC20Weight = _sERC20EndWeight.sub((_sERC20EndWeight.sub(_sERC20StartWeight)).mulUp(_sERC20.totalSupply()).divUp(_sERC20.cap()));
      uint256 sERC20Weight = normalizedStartWeight + (gamma / _sERC20.cap());
      uint256 WETHWeight = FixedPoint.ONE.sub(sERC20Weight);
      console.log(sERC20Weight);
      console.log(WETHWeight);
      
      if (_sERC20IsToken0) {
          _normalizedWeight0 = sERC20Weight;
          _normalizedWeight1 = WETHWeight;
      } else {
          _normalizedWeight0 = WETHWeight;
          _normalizedWeight1 = sERC20Weight;
      }
      
      // // can optimize to avoid re-reading state
      // _maxWeightTokenIndex = _normalizedWeight0 >= _normalizedWeight1 ? 0 : 1;

      // update Invariant ?
      // udpate Oracle ?

    }

    function onSwap(
        SwapRequest memory request,
        uint256 balanceTokenIn,
        uint256 balanceTokenOut
    ) external override whenNotPaused onlyVault(request.poolId) returns (uint256) {
        if (request.userData[0] == 0x01) {

        } else {
          // WeightedPool2Tokens.onSwap(request, balanceTokenIn, balanceTokenOut);
        }
    }

    //     function _normalizedWeights() internal view override returns (uint256[] memory) {
    //     uint256[] memory normalizedWeights = new uint256[](2);
    //     normalizedWeights[0] = _normalizedWeights(true);
    //     normalizedWeights[1] = _normalizedWeights(false);
    //     return normalizedWeights;
    // }

    // hack_ : we need to override this function to SLOAD the overloaded _normalizedWeights* storage data - and not the inherited immutable one
    function _normalizedWeights(bool token0) internal view override returns (uint256) {
        return token0 ? _normalizedWeight0 : _normalizedWeight1;
    }
}