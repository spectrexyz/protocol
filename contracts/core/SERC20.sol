// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "./SERC1155.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20SnapshotUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
 * @title sERC20
 * @notice ERC20 token of spectralized ERC721.
 * @dev This contract is meant to be used as the implementation contract of EIP1167 minimal proxies.
 */
contract SERC20 is
    Initializable,
    ContextUpgradeable,
    AccessControlUpgradeable,
    ERC20Upgradeable,
    ERC20CappedUpgradeable, 
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    ERC20SnapshotUpgradeable,
    ERC20PermitUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");
    bytes32 public constant MINTER_ADMIN_ROLE = keccak256("MINTER_ADMIN_ROLE");
    bytes32 public constant PAUSER_ADMIN_ROLE = keccak256("PAUSER_ADMIN_ROLE");
    bytes32 public constant SNAPSHOT_ADMIN_ROLE = keccak256("SNAPSHOT_ADMIN_ROLE");

    address private _sERC1155;
    bool private _hook;

    /**
     * @notice sERC20 constructor.
     * @dev This contract is meant to be used as the implementation contract of EIP1167 minimal proxies.
     * The initializer modifier prevents the base implementation of being actually initialized.
     * See https://eips.ethereum.org/EIPS/eip-1167.
     */
    constructor() initializer {
    }

    /**
     * @notice Initializes sERC20.
     * @dev Remarks:
     *        - `name_` is left unchecked as per the ERC20 standard.
     *        - `symbol_` is left unchecked as per the ERC20 standard.
     *        - `cap_` > 0 is checked in __ERC20Capped_init().
     *        - `admin` can be set to the zero address to neutralize its privileges.
     * @param name_ The name of the sERC20.
     * @param symbol_ The symbol of the sERC20.
     * @param cap_ The supply cap of the sERC20.
     * @param admin The admin of the sERC20 [allowed to manage its permissions].
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        address admin
    ) external initializer {
        // __Context_init();
        // __AccessControl_init();
        __ERC20_init(name_, symbol_);
        __ERC20Capped_init(cap_);
        // __ERC20Burnable_init();
        // __ERC20Pausable_init();
        // __ERC20Snapshot_init();
        __ERC20Permit_init(name_);
        
        _sERC1155 = _msgSender();

        _setupRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Pauses token transfers.
     */
    function pause() external {
        require(hasRole(PAUSER_ROLE, _msgSender()), "sERC20: must have pauser role to pause");
        _pause();
    }

    /**
     * @notice Unpauses token transfers.
     */
    function unpause() external {
        require(hasRole(PAUSER_ROLE, _msgSender()), "sERC20: must have pauser role to unpause");
        _unpause();
    }

    function setRoleAdmin(bytes32 role, bytes32 adminRole) external {
        require(hasRole(getRoleAdmin(role), _msgSender()), "sERC20: must be admin to set role admin");
        _setRoleAdmin(role, adminRole);
    }

    /**
     * @notice Mint `amount` new tokens for `to`.
     * @param to The recipient of the tokens to mint.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external {
        require(hasRole(MINTER_ROLE, _msgSender()), "sERC20: must have minter role to mint");
        _mint(to, amount);
    }

    /**
     * @notice Creates a new snapshot and returns its snapshot id.
     * @dev This function can potentially be used by attackers in two ways. First, it can be used to increase the cost
     * of retrieval of values from snapshots, although it will grow logarithmically thus rendering this attack
     * ineffective in the long term. Second, it can be used to target specific accounts and increase the cost of sERC20
     * transfers for them. That's the reason why this function is protected by the SNAPSHOT_ROLE.
     */
    function snapshot() external returns (uint256) {
        require(hasRole(SNAPSHOT_ROLE, _msgSender()), "sERC20: must have snapshot role to snapshot");
        return _snapshot();
    }

    /**
     * @notice Handles sERC1155 transfers.
     * @dev This function is called by sERC1155 whenever a transfer is triggered at the sERC1155 layer.
     * @param from The address the tokens have been transferred from.
     * @param to The address the tokens have been transferred to.
     * @param amount The amount of tokens which have been transferred.
     */
    function onSERC1155Transferred(address from, address to, uint256 amount) external {
        require(_msgSender() == _sERC1155, "sERC20: must be sERC1155 to use transfer hook");
        
        _hook = true;
        _transfer(from, to, amount);
        _hook = false;
    }

    /**
     * @notice Returns the `sERC1155` address.
     */
    function sERC1155() public view returns (address) {
        return _sERC1155;
    }

    function _mint(
        address account,
        uint256 amount
    )
        internal
        override(ERC20Upgradeable, ERC20CappedUpgradeable)
    {
        super._mint(account, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    )
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable, ERC20SnapshotUpgradeable)
    {
        // ERC20PausableUpgradeable._beforeTokenTransfer(from, to, amount);
        // ERC20SnapshotUpgradeable._beforeTokenTransfer(from, to, amount);
        super._beforeTokenTransfer(from, to, amount);

        if(!_hook)
            SERC1155(_sERC1155).onSERC20Transferred(from, to, amount);
    }
}