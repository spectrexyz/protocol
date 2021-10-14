// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../token/sIERC20.sol";

interface ISplitter {
    struct Split {
        uint256 totalWithdrawn;
        mapping(address => uint256) shares;
        mapping(address => uint256) withdrawn;
    }

    event Register(sIERC20 indexed sERC20, address[] beneficiaries, uint256[] shares, uint256 fee, uint256 allocation);
    event Withdraw(sIERC20 indexed sERC20, address indexed beneficiary, uint256 amount);
    event SetBank(address bank);
    event SetProtocolFee(uint256 protocolFee);

    function register(
        sIERC20 sERC20,
        address[] calldata beneficiaries,
        uint256[] calldata shares
    ) external returns (uint256);

    function withdraw(sIERC20 sERC20, address beneficiary) external;

    function withdrawBatch(sIERC20[] calldata sERC20s, address beneficiary) external;

    function setBank(address bank_) external;

    function setProtocolFee(uint256 fee_) external;

    function bank() external view returns (address);

    function protocolFee() external view returns (uint256);

    function stateOf(sIERC20 sERC20) external view returns (uint256 received, uint256 totalWithdrawn);

    function shareOf(sIERC20 sERC20, address beneficiary) external view returns (uint256);

    function withdrawnBy(sIERC20 sERC20, address beneficiary) external view returns (uint256);
}
