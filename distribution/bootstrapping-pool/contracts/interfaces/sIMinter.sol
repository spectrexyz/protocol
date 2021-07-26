// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../sBootstrappingPool.sol";


interface sIMinter {
    struct Pit {
        sBootstrappingPool pool;
        bytes32            poolId;
        address payable    beneficiary;
        uint256            initialPrice;
        uint256            allocation;
        uint256            fee;
        bool               sERC20IsToken0;
    }

    event Register(address indexed sERC20, address pool, address beneficiary, uint256 initialPrice, uint256 allocation, uint256 fee);
    event Mint(address indexed sERC20, address indexed recipient, uint256 value, uint256 amount);

  /* #region core */
    /**
     * @notice Registers `pit` for `sERC20`.
     * @param  sERC20 The sERC20 to register the pit for.
     * @param  pit    The pit to register.
     */
    function register(address sERC20, Pit calldata pit)                        external;
    /**
     * @notice Mints sERC20s against sent ETH.
     * @param  sERC20    The sERC20 to mint.
     * @param  expected  The amount of sERC20 tokens expected in return for the ETH sent [reverts otherwise].
     * @param  recipient The recipient of the sERC20 tokens to mint.
     */
    function mint(address sERC20, uint256 expected, address payable recipient) external payable;
    /**
     * @notice Transfer any ERC20 or ETH send by mistake to this contract to the bank.
     * @param  token The address of the ERC20 token to withdraw [address(0) for ETH].
     */
    function withdraw(address token)                                           external;
  /* #endregion */

  /* #region setters */
    function setBank(address payable bank)       external;
    function setSplitter(address splitter)       external;
    function setVault(address vault)             external;
    function setProtocolFee(uint256 protocolFee) external;
  /* #endregion*/

  /* #region getters */
    /**
     * @notice Returns the address of the sMinter's bank.
     */
    function bank()                external view returns (address);
    /**
     * @notice Returns the address of the allocation splitter contract.
     */
    function splitter()            external view returns (address);
    /**
     * @notice Returns the address of Balancer V2's Vault.
     */
    function vault()               external view returns (IVault);
    /**
     * @notice Returns the current protocol fee.
     */
    function protocolFee()         external view returns (uint256);
    function pitOf(address sERC20) external view returns (Pit memory);
  /* #endregion*/
}
