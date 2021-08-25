// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;

import "../../../vault/interfaces/0.7/IVault.sol";
import "@openzeppelin/contracts-upgradeable-0.7/token/ERC20/IERC20Upgradeable.sol";

interface sIERC20 is IERC20Upgradeable {
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        address admin
    ) external;

    function hasRole(bytes32 role, address account) external view returns (bool);

    function getRoleMemberCount(bytes32 role) external view returns (uint256);

    function getRoleMember(bytes32 role, uint256 index) external view returns (address);

    function getRoleAdmin(bytes32 role) external view returns (bytes32);

    function grantRole(bytes32 role, address account) external;

    function revokeRole(bytes32 role, address account) external;

    function renounceRole(bytes32 role, address account) external;

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
