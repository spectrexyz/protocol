// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;

import "../../../token/interfaces/0.7/sIERC20.sol";

interface ISplitter {
    struct Split {
        uint256 totalWithdrawn;
        mapping(address => uint256) shares;
        mapping(address => uint256) withdrawn;
    }

    event Register(sIERC20 indexed sERC20, address[] beneficiaries, uint256[] shares);
    event Withdraw(sIERC20 indexed sERC20, address indexed beneficiary, uint256 amount);

    function register(
        sIERC20 sERC20,
        address[] calldata beneficiaries,
        uint256[] calldata shares
    ) external;

    function withdraw(sIERC20 sERC20, address beneficiary) external;

    function withdrawBatch(sIERC20[] calldata sERC20s, address beneficiary) external;

    function stateOf(sIERC20 sERC20) external view returns (uint256 received, uint256 totalWithdrawn);

    function shareOf(sIERC20 sERC20, address beneficiary) external view returns (uint256);

    function withdrawnBy(sIERC20 sERC20, address beneficiary) external view returns (uint256);
}
