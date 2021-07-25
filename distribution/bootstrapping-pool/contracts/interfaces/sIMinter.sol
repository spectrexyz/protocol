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
    event Mint(address indexed sERC20, uint256 value, uint256 expected, uint256 amount);

  /* #region core */
    function register(address sERC20_, Pit calldata pit)                       external;
    function withdraw(address token)                                           external;
    function mint(address sERC20, uint256 expected, address payable recipient) external payable;
  /* #endregion */

  /* #region setters */
    function setBank(address payable bank)       external;
    function setSplitter(address splitter)       external;
    function setVault(address vault)             external;
    function setProtocolFee(uint256 protocolFee) external;
  /* #endregion*/

  /* #region getters */
    function bank()                external view returns (address);
    function splitter()            external view returns (address);
    function vault()               external view returns (IVault);
    function protocolFee()         external view returns (uint256);
    function pitOf(address sERC20) external view returns (Pit memory);
  /* #endregion*/
}
