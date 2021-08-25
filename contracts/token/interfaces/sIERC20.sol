// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../../vault/interfaces/IVault.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";

interface sIERC20 is IAccessControlUpgradeable, IERC20Upgradeable, IERC20MetadataUpgradeable, IERC20PermitUpgradeable {
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        address admin
    ) external;

    function setRoleAdmin(bytes32 role, bytes32 adminRole) external;

    function burn(uint256 amount) external;

    function burn(address account, uint256 amount) external;

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
