// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "./SERC1155.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
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
    AccessControlEnumerableUpgradeable,
    ERC20Upgradeable,
    ERC20CappedUpgradeable, 
    ERC20PausableUpgradeable,
    ERC20BurnableUpgradeable,
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

    /**
     * @notice sERC20 constructor.
     * @dev This contract is meant to be used as the implementation contract of EIP1167 minimal proxies.
     * The initializer modifier prevents the base implementation of being actually initialized.
     * See https://eips.ethereum.org/EIPS/eip-1167.
     */
    constructor() initializer {
    }

    /**
     * @notice sERC20 initializer.
     * @dev Remarks:
     *        - `name_` is left unchecked as per the ERC20 standard.
     *        - `symbol_` is left unchecked as per the ERC20 standard.
     *        - `cap_` > 0 is checked in __ERC20Capped_init().
     *        - `sERC115_` can be set to the zero address to neutralize its privilege.
     *        - `roles` can be set to the zero address to neutralize their privileges.
     * @param name_ The name of the sERC20.
     * @param symbol_ The symbol of the sERC20.
     * @param cap_ The supply cap of the sERC20.
     * @param roles The addresses to which to assign sERC20 roles.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        address[6] memory roles
    ) external initializer {
        __Context_init();
        __AccessControlEnumerable_init();
        __ERC20_init(name_, symbol_);
        __ERC20Capped_init(cap_);
        __ERC20Pausable_init();
        __ERC20Burnable_init();
        __ERC20Snapshot_init();
        __ERC20Permit_init(name_);
        
        _sERC1155 = _msgSender();
        _setupRole(MINTER_ROLE, roles[0]);
        _setupRole(PAUSER_ROLE, roles[1]);
        _setupRole(SNAPSHOT_ROLE, roles[2]);
        _setupRole(MINTER_ADMIN_ROLE, roles[3]);
        _setupRole(PAUSER_ADMIN_ROLE, roles[4]);
        _setupRole(SNAPSHOT_ADMIN_ROLE, roles[5]);
        _setRoleAdmin(MINTER_ROLE, MINTER_ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, PAUSER_ADMIN_ROLE);
        _setRoleAdmin(SNAPSHOT_ROLE, SNAPSHOT_ADMIN_ROLE);
    }

    function mint(address to, uint256 amount) external {
        require(hasRole(MINTER_ROLE, _msgSender()), "sERC20: must have minter role to mint");
        _mint(to, amount);
    }

    function snapshot() external returns (uint256) {
        require(hasRole(SNAPSHOT_ROLE, _msgSender()), "sERC20: must have snapshot role to snapshot");
        return _snapshot();
    }

    function pause() external {
        require(hasRole(PAUSER_ROLE, _msgSender()), "sERC20: must have pauser role to pause");
        _pause();
    }

    function unpause() external {
        require(hasRole(PAUSER_ROLE, _msgSender()), "sERC20: must have pauser role to unpause");
        _unpause();
    }

    function onSERC1155Transferred(address sender, address recipient, uint256 amount) external {
        require(_msgSender() == _sERC1155, "sERC20: must be sERC1155 to use transfer hook");
        
        _transfer(sender, recipient, amount);
    }

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
        override(ERC20Upgradeable, ERC20SnapshotUpgradeable, ERC20PausableUpgradeable)
    {
        ERC20PausableUpgradeable._beforeTokenTransfer(from, to, amount);
        ERC20SnapshotUpgradeable._beforeTokenTransfer(from, to, amount);
        SERC1155(_sERC1155).onSERC20Transferred(from, to, amount);
    }
}