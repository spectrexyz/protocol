// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./ISplitter.sol";
import "../token/sIERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title Splitter
 * @notice Splits received sERC20s between registered beneficiaries.
 */
contract Splitter is Context, AccessControlEnumerable, ISplitter {
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    uint256 public constant HUNDRED = 1e20; // 100% = 1e20 | 1% = 1e18 | 0% = 0

    mapping(sIERC20 => Split) _splits;

    constructor(address registrar) {
        _setupRole(REGISTER_ROLE, registrar);
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @notice Register an `sERC20` whose received tokens are to split between `beneficiaries` with respect to `shares`.
     * @dev - We do not check neither that `sERC20` is unregistered nor that it actually is an sERC20 to save gas.
     *      - Indeed, only trusted templates, registering sERC20s out of actual NFT spectralizations, are supposed to be granted REGISTER_ROLE.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by the template.
     * @param sERC20 The sERC20 whose received tokens are to split between beneficiaries.
     * @param beneficiaries The addresses between which to split the received sERC20s.
     * @param shares The respective shares of the beneficiaries over the received sERC20s [expressed with 1e18 decimals].
     */
    function register(
        sIERC20 sERC20,
        address[] calldata beneficiaries,
        uint256[] calldata shares
    ) external override {
        Split storage split = _splits[sERC20];

        require(hasRole(REGISTER_ROLE, _msgSender()), "Splitter: must have REGISTER_ROLE to register");
        require(beneficiaries.length == shares.length, "Splitter: beneficiaries and shares length mismatch");

        address beneficiary;
        uint256 share;
        uint256 total;

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            beneficiary = beneficiaries[i];
            share = shares[i];

            require(beneficiary != address(0), "Splitter: beneficiary cannot be the zero address");
            require(share != uint256(0), "Splitter: share cannot be worth zero");

            split.shares[beneficiary] = share;
            total += share;
        }

        require(total == HUNDRED, "Splitter: shares must add up to 100%");

        emit Register(sERC20, beneficiaries, shares);
    }

    /**
     * @notice Withdraw `sERC20` tokens due to `beneficiary`.
     * @dev - We do not check neither that `sERC20` is registered nor that split.shares[beneficiary] != 0.
     *      - Indeed, the contract already reverts in such a situation for due == withdrawn == 0.
     * @param sERC20 The sERC20 to withdraw.
     * @param beneficiary The beneficiary from whom to withdraw the due sERC20 tokens.
     */
    function withdraw(sIERC20 sERC20, address beneficiary) external override {
        Split storage split = _splits[sERC20];

        uint256 due = ((sERC20.balanceOf(address(this)) + split.totalWithdrawn) * split.shares[beneficiary]) / HUNDRED;
        uint256 withdrawn = split.withdrawn[beneficiary];
        uint256 amount = due - withdrawn;

        require(due > withdrawn, "Splitter: nothing to withdraw");

        split.withdrawn[beneficiary] += amount;
        split.totalWithdrawn += amount;

        sERC20.transfer(beneficiary, amount);

        emit Withdraw(sERC20, beneficiary, amount);
    }

    /**
     * @notice Batch withdraw `sERC20s` tokens due to `beneficiary`.
     * @dev - The same security remarks as apply as, plus:
     *      - It is up to the user not to include the same sERC20 twice in `sERC20s` - otherwise the transaction reverts.
     *      - We do not check the sERC20s array length as the gas limit can rise in the future.
     *      - Therefore, it is up to the user to make sure he does not run out of gas.
     * @param sERC20s The sERC20s to withdraw.
     * @param beneficiary The beneficiary from whom to withdraw the due sERC20s tokens.
     */
    function withdrawBatch(sIERC20[] calldata sERC20s, address beneficiary) external override {
        sIERC20 sERC20;
        uint256 due;
        uint256 withdrawn;
        uint256 amount;

        for (uint256 i = 0; i < sERC20s.length; i++) {
            sERC20 = sERC20s[i];
            Split storage split = _splits[sERC20];

            due = ((sERC20.balanceOf(address(this)) + split.totalWithdrawn) * split.shares[beneficiary]) / HUNDRED;
            withdrawn = split.withdrawn[beneficiary];
            amount = due - withdrawn;

            require(due > withdrawn, "Splitter: nothing to withdraw");

            split.withdrawn[beneficiary] += amount;
            split.totalWithdrawn += amount;

            sERC20.transfer(beneficiary, amount);

            emit Withdraw(sERC20, beneficiary, amount);
        }
    }

    /**
     * @notice Return the amount of `sERC20` tokens received and whithdrawn.
     */
    function stateOf(sIERC20 sERC20) public view override returns (uint256 received, uint256 totalWithdrawn) {
        Split storage split = _splits[sERC20];

        totalWithdrawn = split.totalWithdrawn;
        received = sERC20.balanceOf(address(this)) + totalWithdrawn;
    }

    /**
     * @notice Return the share of `beneficiary` over the received `sERC20` tokens [expressed with 1e18 decimals].
     */
    function shareOf(sIERC20 sERC20, address beneficiary) public view override returns (uint256) {
        return _splits[sERC20].shares[beneficiary];
    }

    /**
     * @notice Return the amount of `sERC20` tokens already withdrawn by `beneficiary`.
     */
    function withdrawnBy(sIERC20 sERC20, address beneficiary) public view override returns (uint256) {
        return _splits[sERC20].withdrawn[beneficiary];
    }
}
