// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "./interfaces/sIERC20.sol";
import "../vault/interfaces/IVault.sol";
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
 * @notice ERC20 of spectralized ERC721.
 * @dev - This contract is meant to be used as the implementation contract of EIP-1167 minimal proxies.
 *      - See https://eips.ethereum.org/EIPS/eip-1167.
 */
contract sERC20 is
    Initializable,
    ContextUpgradeable,
    AccessControlUpgradeable,
    ERC20Upgradeable,
    ERC20CappedUpgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    ERC20SnapshotUpgradeable,
    ERC20PermitUpgradeable,
    sIERC20
{
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

    IVault private _vault;
    bool private _isHooked;

    /**
     * @dev - This contract is meant to be used as the implementation contract of EIP-1167 minimal proxies.
     *      - The initializer modifier prevents the base implementation of being actually initialized.
     *      - See https://eips.ethereum.org/EIPS/eip-1167.
     */
    constructor() initializer {}

    /**
     * @notice Initialize sERC20.
     * @dev - `name_` is left unchecked as per the ERC20 standard.
     *      - `symbol_` is left unchecked as per the ERC20 standard.
     *      - `cap_` > 0 is checked in __ERC20Capped_init().
     *      - `admin` can be set to the zero address to neutralize its privileges.
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
    ) external override initializer {
        // __Initializable_init()  // does not exist
        // __Context_init();       // does nothing so let's save gas
        // __AccessControl_init(); // does nothing so let's save gas
        __ERC20_init(name_, symbol_);
        __ERC20Capped_init(cap_);
        // __ERC20Burnable_init(); // does nothing so let's save gas
        // __ERC20Pausable_init(); // does nothing so let's save gas
        // __ERC20Snapshot_init(); // does nothing so let's save gas
        __ERC20Permit_init(name_);

        _vault = IVault(_msgSender());
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Set `adminRole` as `role`'s admin role.
     */
    function setRoleAdmin(bytes32 role, bytes32 adminRole) external override {
        require(hasRole(getRoleAdmin(role), _msgSender()), "sERC20: must be role admin to set role admin");

        _setRoleAdmin(role, adminRole);
    }

    /**
     * @notice Destroy `amount` tokens.
     * @param amount The amount of tokens to destroy.
     */
    function burn(uint256 amount) public override(ERC20BurnableUpgradeable, sIERC20) {
        ERC20BurnableUpgradeable.burn(amount);
    }

    /**
     * @notice Destroy `amount` tokens from `account`, deducting from the caller's allowance.
     * @param account The account whose tokens to destroy.
     * @param amount  The amount of tokens to destroy.
     */
    function burnFrom(address account, uint256 amount) public override(ERC20BurnableUpgradeable, sIERC20) {
        ERC20BurnableUpgradeable.burnFrom(account, amount);
    }

    /**
     * @notice Mint `amount` new tokens for `to`.
     * @dev Caller must have MINT_ROLE.
     * @param to The recipient of the tokens to mint.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external override {
        require(hasRole(MINT_ROLE, _msgSender()), "sERC20: must have MINT_ROLE to mint");

        _mint(to, amount);
    }

    /**
     * @notice Pause tokens transfer, minting and burning.
     * @dev Caller must have PAUSE_ROLE.
     */
    function pause() external override {
        require(hasRole(PAUSE_ROLE, _msgSender()), "sERC20: must have PAUSE_ROLE to pause");

        _pause();
    }

    /**
     * @notice Unpause tokens transfer, minting and burning.
     * @dev Caller must have PAUSE_ROLE.
     */
    function unpause() external override {
        require(hasRole(PAUSE_ROLE, _msgSender()), "sERC20: must have PAUSE_ROLE to unpause");

        _unpause();
    }

    /**
     * @notice Create a new snapshot and returns its snapshot id.
     * @dev - This function can potentially be used by attackers in two ways.
     *      - First, it can be used to increase the cost of retrieval of values from snapshots although it will grow logarithmically thus rendering this attack
     *        ineffective in the long term.
     *      - Second, it can be used to target specific accounts and increase the cost of sERC20 transfers for them.
     *      - That's the reason why this function is protected by SNAPSHOT_ROLE.
     */
    function snapshot() external override returns (uint256) {
        require(hasRole(SNAPSHOT_ROLE, _msgSender()), "sERC20: must have SNAPSHOT_ROLE to snapshot");

        return _snapshot();
    }

    /**
     * @notice Handle ERC1155 transfers.
     * @dev - This function is called by the sERC20's pegged ERC1155 whenever a transfer is triggered at the vault layer.
     *      - This function can only be called by the sERC20's vault.
     * @param from The address the tokens have been transferred from.
     * @param to The address the tokens have been transferred to.
     * @param amount The amount of tokens which have been transferred.
     */
    function onERC1155Transferred(
        address from,
        address to,
        uint256 amount
    ) external override {
        require(_msgSender() == address(_vault), "sERC20: must be vault to use transfer hook");

        _isHooked = true;
        _transfer(from, to, amount);
        _isHooked = false;
    }

    /**
     * @notice Return the sERC20's vault address.
     */
    function vault() public view override returns (IVault) {
        return _vault;
    }

    /**
     * @notice Return the sERC20's total supply cap.
     */
    function cap() public view override(ERC20CappedUpgradeable, sIERC20) returns (uint256) {
        return ERC20CappedUpgradeable.cap();
    }

    /**
     * @notice Return true if the contract is paused, false otherwise.
     */
    function paused() public view override(PausableUpgradeable, sIERC20) returns (bool) {
        return PausableUpgradeable.paused();
    }

    /**
     * @notice Return the sERC20 balance of `account` at the time `snapshotId` was created.
     */
    function balanceOfAt(address account, uint256 snapshotId) public view override(ERC20SnapshotUpgradeable, sIERC20) returns (uint256) {
        return ERC20SnapshotUpgradeable.balanceOfAt(account, snapshotId);
    }

    /**
     * @notice Return the sERC20's total supply at the time `snapshotId` was created.
     */
    function totalSupplyAt(uint256 snapshotId) public view override(ERC20SnapshotUpgradeable, sIERC20) returns (uint256) {
        return ERC20SnapshotUpgradeable.totalSupplyAt(snapshotId);
    }

    function _mint(address account, uint256 amount) internal override(ERC20Upgradeable, ERC20CappedUpgradeable) {
        super._mint(account, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable, ERC20SnapshotUpgradeable) {
        super._beforeTokenTransfer(from, to, amount);

        if (!_isHooked) _vault.onERC20Transferred(from, to, amount);
    }
}
