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

    address private _bank;
    uint256 private _fee;

    mapping(sIERC20 => Split) _splits;

    constructor(address bank_, uint256 fee_) {
        require(bank_ != address(0), "Splitter: bank cannot be the zero address");
        require(fee_ < HUNDRED, "Splitter: fee must be inferior to 100%");

        _setBank(bank_);
        _setFee(fee_);
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @notice Register an `sERC20` whose received tokens are to split between `beneficiaries` with respect to `shares`.
     * @dev - We do not check neither that `sERC20` is unregistered nor that it actually is an sERC20 to save gas.
     *      - Indeed, only trusted templates, registering sERC20s out of actual NFT fractionalizations, are supposed to be granted REGISTER_ROLE.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by templates.
     * @param sERC20 The sERC20 whose received tokens are to split between beneficiaries.
     * @param beneficiaries The addresses between which to split the received sERC20s.
     * @param shares The respective shares of the beneficiaries [expressed with 1e18 decimals].
     */
    function register(
        sIERC20 sERC20,
        address[] calldata beneficiaries,
        uint256[] calldata shares
    ) external override returns (uint256) {
        Split storage split = _splits[sERC20];

        require(hasRole(REGISTER_ROLE, _msgSender()), "Splitter: must have REGISTER_ROLE to register");
        require(beneficiaries.length == shares.length, "Splitter: beneficiaries and shares length mismatch");

        uint256 total;
        uint256 share;

        for (uint256 i = 0; i < shares.length; i++) {
            share = shares[i];

            require(beneficiaries[i] != address(0), "Splitter: beneficiary cannot be the zero address");
            require(share != uint256(0), "Splitter: share cannot be worth zero");
            total += share;
        }

        total += _fee;

        require(total < HUNDRED, "Splitter: total allocation must be inferior to 100%");

        if (total > 0) {
            uint256 normalizedShare;
            uint256 normalizedTotal;

            for (uint256 i = 0; i < beneficiaries.length; i++) {
                normalizedShare = (shares[i] * HUNDRED) / total;
                split.shares[beneficiaries[i]] = normalizedShare;
                normalizedTotal += normalizedShare;
            }

            // avoid rounding issues
            split.shares[_bank] = HUNDRED - normalizedTotal;
        }

        emit Register(sERC20, beneficiaries, shares, _fee, total);

        return total;
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
     * @dev - The same security remarks as above apply, plus:
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
     * @notice Set the splitter's bank.
     * @param bank_ The bank to set.
     */
    function setBank(address bank_) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Splitter: must have DEFAULT_ADMIN_ROLE to set bank");
        require(bank_ != address(0), "Splitter: bank cannot be the zero address");

        _setBank(bank_);
    }

    /**
     * @notice Set the splitter's fee.
     * @param fee_ The fee to set [expressed with 1e18 decimals].
     */
    function setFee(uint256 fee_) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Splitter: must have DEFAULT_ADMIN_ROLE to set fee");
        require(fee_ < HUNDRED, "Splitter: fee must be inferior to 100%");

        _setFee(fee_);
    }

    /**
     * @notice Return the splitter's bank.
     */
    function bank() public view returns (address) {
        return _bank;
    }

    /**
     * @notice Return the splitter's fee.
     */
    function fee() public view returns (uint256) {
        return _fee;
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

    function _setBank(address bank_) private {
        _bank = bank_;

        emit SetBank(bank_);
    }

    function _setFee(uint256 fee_) private {
        _fee = fee_;

        emit SetFee(fee_);
    }
}
