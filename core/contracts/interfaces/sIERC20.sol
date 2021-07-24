// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";

interface sIERC20 is IAccessControlUpgradeable, IERC20Upgradeable, IERC20MetadataUpgradeable, IERC20PermitUpgradeable {
  /* #region initializer */
    /**
     * @notice Initializes sERC20.
     * @param  name_   The name of the sERC20.
     * @param  symbol_ The symbol of the sERC20.
     * @param  cap_    The supply cap of the sERC20.
     * @param  admin   The admin of the sERC20 [allowed to manage its permissions].
     */
    function initialize(string memory name_, string memory symbol_, uint256 cap_, address admin) external;
  /* #endregion */

  /* #region state-modifying functions */
    /**
     * @notice Sets `adminRole` as `role`'s admin role.
     */
    function setRoleAdmin(bytes32 role, bytes32 adminRole) external;
    /**
     * @notice Destroys `amount` tokens from the caller.
     * @param  amount The amount of tokens to destroy.
     */
    function burn(uint256 amount)                          external;
    /**
     * @notice Destroys `amount` tokens from `account`, deducting from the caller's allowance.
     * @param  account The account whose tokens to destroy.
     * @param  amount  The amount of tokens to destroy.
     */
    function burnFrom(address account, uint256 amount)     external;
    /**
     * @notice Mints `amount` new tokens for `to`.
     * @param  to     The recipient of the tokens to mint.
     * @param  amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount)              external;
    /**
     * @notice Pauses tokens transfers, mints and burns.
     */
    function pause()                                       external;
    /**
     * @notice Unpauses tokens transfers, mints and burns.
     */
    function unpause()                                     external;
    /**
     * @notice Creates a new snapshot and returns its snapshot id.
     */
    function snapshot()                                    external returns (uint256);
  /* #endregion */
  
  /* #region hooks functions */
    /**
     * @notice Handles sERC1155 transfers.
     * @dev    - This function is called by the sERC20's pegged sERC1155 whenever a transfer is triggered at the
     *         sERC1155 layer.
     *         - This function can only be called by the sERC20's pegged sERC1155.
     * @param  from   The address the tokens have been transferred from.
     * @param  to     The address the tokens have been transferred to.
     * @param  amount The amount of tokens which have been transferred.
     */
    function onSERC1155Transferred(address from, address to, uint256 amount) external;
  /* #endregion */

  /* #region view functions */
    /**
     * @notice Returns the sERC20's pegged sERC1155's address.
     */
    function sERC1155()                                       external view returns (address);
    /**
     * @notice Returns the sERC20's total supply cap.
     */
    function cap()                                            external view returns (uint256);
    /**
     * @notice Returns true if the contract is paused, false otherwise.
     */
    function paused()                                         external view returns (bool);
    /**
     * @notice Returns the sERC20 balance of `account` at the time `snapshotId` was created.
     */
    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256);
    /**
     * @notice Return the sERC20's total supply at the time `snapshotId` was created.
     */
    function totalSupplyAt(uint256 snapshotId)                external view returns (uint256);
  /* #endregion */
}