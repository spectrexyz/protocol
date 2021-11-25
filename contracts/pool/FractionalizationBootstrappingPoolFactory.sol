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

pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./FractionalizationBootstrappingPool.sol";
import "@balancer-labs/v2-pool-utils/contracts/factories/BasePoolSplitCodeFactory.sol";
import "@balancer-labs/v2-pool-utils/contracts/factories/FactoryWidePauseWindow.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";

contract FractionalizationBootstrappingPoolFactory is BasePoolSplitCodeFactory, FactoryWidePauseWindow {
    address private immutable _admin;
    address private _issuer;

    event CreatePool(address pool);

    constructor(IVault vault, address admin_) BasePoolSplitCodeFactory(vault, type(FractionalizationBootstrappingPool).creationCode) {
        _admin = admin_;
    }

    /**
     * @notice Deploys a new FractionalizationBootstrappingPool.
     */
    function create(
        string memory name,
        string memory symbol,
        address token0,
        address token1,
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
            token0: IERC20(token0),
            token1: IERC20(token1),
            sMaxNormalizedWeight: sMaxNormalizedWeight,
            sMinNormalizedWeight: sMinNormalizedWeight,
            swapFeePercentage: swapFeePercentage,
            pauseWindowDuration: pauseWindowDuration,
            bufferPeriodDuration: bufferPeriodDuration,
            sERC20IsToken0: sERC20IsToken0,
            owner: address(0),
            issuer: _issuer
        });

        address pool = _create(abi.encode(params));
        emit CreatePool(pool);

        return pool;
    }

    function setIssuer(address issuer_) external {
        require(msg.sender == _admin, "FBPFactory: must be admin to set issuer");

        _issuer = issuer_;
    }

    function admin() public view returns (address) {
        return _admin;
    }

    function issuer() public view returns (address) {
        return _issuer;
    }
}
