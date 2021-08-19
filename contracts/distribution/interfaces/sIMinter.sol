// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../sBootstrappingPool.sol";

interface sIMinter {
    struct Pit {
        sBootstrappingPool pool;
        bytes32 poolId;
        address payable beneficiary;
        uint256 initialPrice;
        uint256 allocation;
        uint256 fee;
        uint256 protocolFee;
        bool sERC20IsToken0;
    }

    /**
     * @notice Emitted when an `sERC20`pit is registered.
     */
    event Register(address indexed sERC20, address pool, address beneficiary, uint256 initialPrice, uint256 allocation, uint256 fee, uint256 protocolFee);
    event Mint(address indexed sERC20, address indexed recipient, uint256 value, uint256 amount);

    /* #region core */
    /**
     * @notice Registers a pit for `sERC20`.
     * @dev    This function is protected by the REGISTER_ROLE.
     * @param  sERC20       The sERC20 to register the pit for.
     * @param  pool         The address of the sERC20's bootstrapping pool [to which LP rewards are transferred].
     * @param  beneficiary  The address of the pit's beneficiary [to which ETH proceeds are transferred]
     * @param  initialPrice The price of the sERC20 before the pool's oracle is functional [expressed in sERC20s / ETH and 18 decimals].
     * @param  allocation   The allocated percentage of sERC20s [expressed with 18 decimals so that 100% = 1e20 and 1% = 1e18].
     * @param  fee          The minting fee [deducted from the ETH proceeds and sent as a reward to LPs].
     */
    function register(
        address sERC20,
        address pool,
        address payable beneficiary,
        uint256 initialPrice,
        uint256 allocation,
        uint256 fee
    ) external;

    /**
     * @notice Mints sERC20s against sent ETH.
     * @param  sERC20    The sERC20 to mint.
     * @param  expected  The amount of sERC20 tokens expected in return for the ETH sent [reverts otherwise].
     * @param  recipient The recipient of the sERC20 tokens to mint.
     */
    function mint(
        address sERC20,
        uint256 expected,
        address payable recipient
    ) external payable;

    /**
     * @notice Transfers any ERC20 or ETH owned by this contract to the bank.
     * @param  token The address of the ERC20 token to withdraw [address(0) for ETH].
     */
    function withdraw(address token) external;

    /* #endregion */

    /* #region setters */
    /**
     * @notice Sets the address of the bank [to which protocol fees are transferred].
     * @dev    This function is protected by the ADMIN_ROLE.
     */
    function setBank(address payable bank) external;

    /**
     * @notice Sets the address of the allocation splitter contract [to which sERC20 allocations are transferred].
     * @dev    This function is protected by the ADMIN_ROLE.
     */
    function setSplitter(address splitter) external;

    /**
     * @notice Sets the protocol fee [expressed with 18 decimals so that 100% = 1e20 and 1% = 1e18].
     * @dev    This function is protected by the ADMIN_ROLE.
     * @param  protocolFee The protocol fee to set.
     */
    function setProtocolFee(uint256 protocolFee) external;

    /* #endregion*/

    /* #region getters */
    /**
     * @notice Returns the address of Balancer V2's Vault.
     */
    function vault() external view returns (IVault);

    /**
     * @notice Returns the address of the sMinter's bank.
     */
    function bank() external view returns (address);

    /**
     * @notice Returns the address of the allocation splitter contract.
     */
    function splitter() external view returns (address);

    /**
     * @notice Returns the current protocol fee.
     */
    function protocolFee() external view returns (uint256);

    /**
     * @notice Returns pit associated to an `sERC20`.
     * @param  sERC20 The address of the sERC20 whose pit is queried.
     */
    function pitOf(address sERC20) external view returns (Pit memory);
    /* #endregion*/
}
