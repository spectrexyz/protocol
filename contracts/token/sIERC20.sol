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

import "../vault/IVault.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

interface sIERC20 is IAccessControlUpgradeable, IERC20Upgradeable, IERC20MetadataUpgradeable {
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        address admin
    ) external;

    function setRoleAdmin(bytes32 role, bytes32 adminRole) external;

    function burn(uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;

    function mint(address to, uint256 amount) external;

    function pause() external;

    function unpause() external;

    function snapshot() external returns (uint256);

    function onERC1155Transferred(
        address from,
        address to,
        uint256 amount
    ) external;

    function vault() external view returns (IVault);

    function cap() external view returns (uint256);

    function paused() external view returns (bool);

    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256);

    function totalSupplyAt(uint256 snapshotId) external view returns (uint256);
}
