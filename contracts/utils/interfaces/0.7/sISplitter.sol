// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;

interface sISplitter {
    function register(address sERC20, address[] calldata beneficiaries, uint256[] calldata shares) external;
    function withdraw(address sERC20, address beneficiary)                                         external;
    function withdrawBatch(address[] calldata sERC20s, address beneficiary)                        external;
    function isRegistered(address sERC20)                                                          external view returns (bool);
    function splitOf(address sERC20)                                                               external view returns (uint256 received, uint256 totalWithdrawn);
    function withdrawnBy(address sERC20, address beneficiary)                                      external view returns (uint256);
}
