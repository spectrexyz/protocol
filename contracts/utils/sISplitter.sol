// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface sISplitter {


    /**
     * @notice Register an `sERC20` to split between `beneficiaries` with respect to `shares` when received.
     * @dev - We do not check that `sERC20` actually is an ERC20 to save gas. Indeed, only spectre's trusted template
     *        is supposed to be granted REGISTER_ROLE - and passes the sERC20 address out of the sERC20 deployment.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by the template.
     * @param sERC20 The sERC20 to split between beneficiaries when received.
     * @param beneficiaries The addresses to split the received sERC20s between when received.
     * @param shares The respective shares of the beneficiaries over the received sERC20s [expressed in PCT_BASE].
     */
    function register(address sERC20, address[] calldata beneficiaries, uint256[] calldata shares) external;

    /**
     * @notice Withdraw `sERC20` tokens due to `beneficiary`.
     * @dev    - We do not check that split.shares[beneficiary] != 0 as the contract already reverts in such a situation
     *         for due == withdrawn == 0.
     * @param  sERC20      The sERC20 to withdraw.
     * @param  beneficiary The beneficiary to withdraw the due sERC20 of.
     */
    function withdraw(address sERC20, address beneficiary) external;

    /**
     * @notice Batch withdraw `sERC20s` tokens due to `beneficiary`.
     * @dev - The same security remarks apply as above, plus:
     *      - It's up to the user not to include the same sERC20 twice in the sERC20s array - in which case the
     *        transaction would revert.
     *      - We do not check the sERC20s array length as the gas limit can rise in the future. Therefore, it is up to
     *        the user to make sure he does not run out of gas.
     * @param sERC20s The sERC20s to withdraw.
     * @param beneficiary The beneficiary to withdraw the due sERC20s of.
     */
    function withdrawBatch(address[] calldata sERC20s, address beneficiary) external;

    function isRegistered(address sERC20) external view returns (bool);

    function splitOf(address sERC20) external view returns (uint256 received, uint256 totalWithdrawn);

    function withdrawnBy(address sERC20, address beneficiary) external view returns (uint256);
}
