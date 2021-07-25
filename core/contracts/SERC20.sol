// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "./interfaces/sIERC20.sol";
import "./interfaces/sIERC1155.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20SnapshotUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
 * @title  sERC20
 * @notice ERC20 token of spectralized ERC721.
 * @dev    - This contract is meant to be used as the implementation contract of EIP-1167 minimal proxies.
 *         - See https://eips.ethereum.org/EIPS/eip-1167.
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
    bytes32 public constant MINT_ROLE     = keccak256("MINT_ROLE");
    bytes32 public constant PAUSE_ROLE    = keccak256("PAUSE_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

    address private _sERC1155;
    bool    private _hooked;

    /**
     * @dev - This contract is meant to be used as the implementation contract of EIP-1167 minimal proxies.
     *      - The initializer modifier prevents the base implementation of being actually initialized.
     *      - See https://eips.ethereum.org/EIPS/eip-1167.
     */
    constructor() initializer {
    }

    /**
     * @dev - `name_` is left unchecked as per the ERC20 standard.
     *      - `symbol_` is left unchecked as per the ERC20 standard.
     *      - `cap_` > 0 is checked in __ERC20Capped_init().
     *      - `admin` can be set to the zero address to neutralize its privileges.
     */
    function initialize(
        string  memory name_,
        string  memory symbol_,
        uint256        cap_,
        address        admin
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
        
        _sERC1155 = _msgSender();
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
    }

  /* #region state-modifying functions */
    function setRoleAdmin(bytes32 role, bytes32 adminRole) external override {
        require(hasRole(getRoleAdmin(role), _msgSender()), "sERC20: must be role admin to set role admin");

        _setRoleAdmin(role, adminRole);
    }

    function burn(uint256 amount) public override(ERC20BurnableUpgradeable, sIERC20) {
        ERC20BurnableUpgradeable.burn(amount);
    }

    function burnFrom(address account, uint256 amount) public override(ERC20BurnableUpgradeable, sIERC20) {
        ERC20BurnableUpgradeable.burnFrom(account, amount);
    }

    function mint(address to, uint256 amount) external override {
        require(hasRole(MINT_ROLE, _msgSender()), "sERC20: must have MINT_ROLE to mint");

        _mint(to, amount);
    }

    function pause() external override {
        require(hasRole(PAUSE_ROLE, _msgSender()), "sERC20: must have PAUSE_ROLE to pause");

        _pause();
    }

    function unpause() external override {
        require(hasRole(PAUSE_ROLE, _msgSender()), "sERC20: must have PAUSE_ROLE to unpause");

        _unpause();
    }

    /**
     * @dev This function can potentially be used by attackers in two ways. First, it can be used to increase the cost
     *      of retrieval of values from snapshots, although it will grow logarithmically thus rendering this attack
     *      ineffective in the long term. Second, it can be used to target specific accounts and increase the cost of
     *      sERC20 transfers for them. That's the reason why this function is protected by SNAPSHOT_ROLE.
     */
    function snapshot() external override returns (uint256) {
        require(hasRole(SNAPSHOT_ROLE, _msgSender()), "sERC20: must have SNAPSHOT_ROLE to snapshot");

        return _snapshot();
    }
  /* #endregion */


  /* #region hooks */
    function onSERC1155Transferred(address from, address to, uint256 amount) external override {
        require(_msgSender() == _sERC1155, "sERC20: must be sERC1155 to use transfer hook");
        
        _hooked = true;
        _transfer(from, to, amount);
        _hooked = false;
    }
  /* #enregion */

  /* #region view functions */
    function sERC1155() public view override returns (address) {
        return _sERC1155;
    }

    function cap() public view override(ERC20CappedUpgradeable, sIERC20) returns (uint256) {
        return ERC20CappedUpgradeable.cap();
    }

    function paused() public view override(PausableUpgradeable, sIERC20) returns (bool) {
        return PausableUpgradeable.paused();
    }

    function balanceOfAt(address account, uint256 snapshotId)
        public
        view
        override(ERC20SnapshotUpgradeable, sIERC20)
        returns (uint256)
    {
        return ERC20SnapshotUpgradeable.balanceOfAt(account, snapshotId);
    }

    function totalSupplyAt(uint256 snapshotId)
        public
        view
        override(ERC20SnapshotUpgradeable, sIERC20)
        returns (uint256)
    {
        return ERC20SnapshotUpgradeable.totalSupplyAt(snapshotId);
    }
  /* #endregion */

  /* #region private functions */
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
        super._beforeTokenTransfer(from, to, amount);

        if(!_hooked)
            sIERC1155(_sERC1155).onSERC20Transferred(from, to, amount);
    }
  /* #endregion */
}