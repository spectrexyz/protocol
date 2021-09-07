// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interfaces/IBalancer.sol";
import "./libraries/Markets.sol";
import "../token/sIERC20.sol";

interface IIssuer {
    /**
     * @notice Emitted when an `sERC20`pit is registered.
     */
    event Register(address indexed sERC20, address pool, address beneficiary, uint256 initialPrice, uint256 allocation, uint256 fee, uint256 protocolFee);
    event Mint(sIERC20 indexed sERC20, address indexed recipient, uint256 value, uint256 amount);
    event CreateProposal(sIERC20 indexed sERC20, uint256 indexed proposalId, address indexed buyer, uint256 value, uint256 amount, uint256 expiration);

    /* #region core */
    /**
     * @notice Registers a pit for `sERC20`.
     * @dev    This function is protected by the REGISTER_ROLE.
     * @param  sERC20       The sERC20 to register the pit for.
     * @param  pool         The address of the sERC20's bootstrapping pool [to which LP rewards are transferred].
     * @param  beneficiary  The address of the pit's beneficiary [to which ETH proceeds are transferred]
     * @param  reserve The price of the sERC20 before the pool's oracle is functional [expressed in sERC20s / ETH and 18 decimals].
     * @param  allocation   The allocated percentage of sERC20s [expressed with 18 decimals so that 100% = 1e20 and 1% = 1e18].
     * @param  fee          The minting fee [deducted from the ETH proceeds and sent as a reward to LPs].
     */
    function register(
        sIERC20 sERC20,
        address pool,
        address payable beneficiary,
        uint256 reserve,
        uint256 allocation,
        uint256 fee,
        bool flash
    ) external;

    // /**
    //  * @notice Mints sERC20s against sent ETH.
    //  * @param  sERC20    The sERC20 to mint.
    //  * @param  expected  The amount of sERC20 tokens expected in return for the ETH sent [reverts otherwise].
    //  * @param  recipient The recipient of the sERC20 tokens to mint.
    //  */
    function mint(sIERC20 sERC20, uint256 expected) external payable;

    function createProposal(
        sIERC20 sERC20,
        uint256 amount,
        uint256 lifespan
    ) external payable returns (uint256);

    function close(sIERC20 sERC20) external;

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
    function vault() external view returns (IBVault);

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
    // function marketOf(address sERC20) external view returns (Markets.Market memory);
    /* #endregion*/

    function twapOf(sIERC20 sERC20) external view returns (uint256);
}
