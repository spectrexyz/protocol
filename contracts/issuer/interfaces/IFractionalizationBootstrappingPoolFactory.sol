// SPDX-License-Identifier: GPL-3.0
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

pragma solidity 0.8.9;

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
