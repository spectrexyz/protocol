// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../core/interfaces/sIERC20.sol";
import "./interfaces/ISplitter.sol";
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
     * @dev - We do not check that `sERC20` actually is an NFT-pegged sERC20 to save gas. Indeed, only spectre's trusted template is supposed to be granted
     *        REGISTER_ROLE - and it passes the sERC20 address out of the NFT spectralization.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by the template.
     * @param sERC20 The sERC20 whose received tokens are to split between beneficiaries.
     * @param beneficiaries The addresses to split the received sERC20s between.
     * @param shares The respective shares of the beneficiaries over the received sERC20s [expressed with 1e18 decimals].
     */
    function register(
        sIERC20 sERC20,
        address[] calldata beneficiaries,
        uint256[] calldata shares
    ) external override {
        Split storage split = _splits[sERC20];

        require(hasRole(REGISTER_ROLE, _msgSender()), "Splitter: must have REGISTER_ROLE to register");
        require(split.sERC20 == address(0), "Splitter: sERC20 already registered");
        // maybe we can remove this one too ... this way we do not even have to store the sERC20 address
        require(beneficiaries.length == shares.length, "Splitter: beneficiaries and shares length mismatch");

        split.sERC20 = address(sERC20);
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
     * @dev - We do not check that split.shares[beneficiary] != 0 as the contract already reverts in such a situation
     *        for due == withdrawn == 0.
     * @param sERC20 The sERC20 to withdraw.
     * @param beneficiary The beneficiary to withdraw the due sERC20 tokens of.
     */
    function withdraw(sIERC20 sERC20, address beneficiary) external override {
        Split storage split = _splits[sERC20];

        require(split.sERC20 != address(0), "Splitter: unregistered sERC20");

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
     * @dev - The same security remarks apply as above, plus:
     *      - It's up to the user not to include the same sERC20 twice in the sERC20s array - in which case the
     *        transaction reverts.
     *      - We do not check the sERC20s array length as the gas limit can rise in the future. Therefore, it is up to
     *        the user to make sure he does not run out of gas.
     * @param sERC20s The sERC20s to withdraw.
     * @param beneficiary The beneficiary to withdraw the due sERC20s tokens of.
     */
    function withdrawBatch(sIERC20[] calldata sERC20s, address beneficiary) external override {
        sIERC20 sERC20;
        uint256 due;
        uint256 withdrawn;
        uint256 amount;

        for (uint256 i = 0; i < sERC20s.length; i++) {
            sERC20 = sERC20s[i];
            Split storage split = _splits[sERC20];

            require(split.sERC20 != address(0), "Splitter: unregistered sERC20");

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

    function isRegistered(sIERC20 sERC20) public view override returns (bool) {
        return _splits[sERC20].sERC20 != address(0);
    }

    function stateOf(sIERC20 sERC20) public view override returns (uint256 received, uint256 totalWithdrawn) {
        Split storage split = _splits[sERC20];

        totalWithdrawn = split.totalWithdrawn;
        received = sERC20.balanceOf(address(this)) + totalWithdrawn;
    }

    function shareOf(sIERC20 sERC20, address beneficiary) public view override returns (uint256) {
        return _splits[sERC20].shares[beneficiary];
    }

    function withdrawnBy(sIERC20 sERC20, address beneficiary) public view override returns (uint256) {
        return _splits[sERC20].withdrawn[beneficiary];
    }
}
