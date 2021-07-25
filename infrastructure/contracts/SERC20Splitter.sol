// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@spectrexyz/protocol-core/contracts/interfaces/sIERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title  sSplitter
 * @notice Split sERC20s between registered beneficiaries when received.
 */
contract sERC20Splitter is Context, AccessControlEnumerable {
    struct Split {
        address sERC20; // more efficient than bool to check if a split has been registered
        uint256 totalWithdrawn;
        mapping (address => uint256) shares;
        mapping (address => uint256) withdrawn;
    }

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    uint256 public constant PCT_BASE = 1 ether; // 0% = 0 | 100% = 10^18 | 10% = 10^17

    mapping (address => Split) _splits;

    event Register(address indexed sERC20, address[] beneficiaries, uint256[] shares);
    event Withdraw(address indexed sERC20, address indexed beneficiary, uint256 amount);


    constructor(address registrar) { 
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(REGISTRAR_ROLE, registrar);
    }

    /**
     * @notice Register an `sERC20` to split between `beneficiaries` with respect to `shares` when received.
     * @dev - We do not check that `sERC20` actually is an ERC20 to save gas. Indeed, only spectre's trusted template
     *        is supposed to be granted REGISTER_ROLE - and passes the sERC20 address out of the sERC20 deployment.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by the template.
     * @param sERC20 The sERC20 to split between beneficiaries when received.
     * @param beneficiaries The addresses to split the received sERC20s between when received.
     * @param shares The respective shares of the beneficiaries over the received sERC20s [expressed in PCT_BASE].
     */
    function register(address sERC20, address[] calldata beneficiaries, uint256[] calldata shares) external {
        Split storage split = _splits[sERC20];

        require(hasRole(REGISTRAR_ROLE, _msgSender()), "SERC20Splitter: must have register role to register");
        require(split.sERC20 == address(0), "SERC20Splitter: sERC20 split already registered");
        require(beneficiaries.length == shares.length, "SERC20Splitter: beneficiaries and shares length mismatch");
        
        split.sERC20 = sERC20;
        address beneficiary;
        uint256 share;
        uint256 total;

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            beneficiary = beneficiaries[i];
            share = shares[i];

            require(beneficiary != address(0), "SERC20Splitter: beneficiary cannot be the zero address");
            require(share != uint256(0), "SERC20Splitter: share cannot be worth zero");

            split.shares[beneficiary] = share;
            total += share;
        }

        require(total == PCT_BASE, "SERC20Splitter: shares must add up to 100%");

        emit Register(sERC20, beneficiaries, shares);
    }

    /**
     * @notice Withdraw `sERC20` tokens due to `beneficiary`.
     * @dev - We do not check that split.shares[beneficiary] != 0 as the contract already reverts in such a situation
     *        for due == withdrawn == 0.
     * @param sERC20 The sERC20 to withdraw.
     * @param beneficiary The beneficiary to withdraw the due sERC20 of.
     */
    function withdraw(address sERC20, address beneficiary) external {
        Split storage split = _splits[sERC20];
        
        require(split.sERC20 != address(0), "SERC20Splitter: unsplit sERC20");
        
        uint256 due =
            (SERC20(sERC20).balanceOf(address(this)) + split.totalWithdrawn) * split.shares[beneficiary] / PCT_BASE;
        uint256 withdrawn = split.withdrawn[beneficiary];
        require(due > withdrawn, "SERC20Splitter: nothing to withdraw");
        
        uint256 amount = due - withdrawn;
        split.withdrawn[beneficiary] += amount;
        split.totalWithdrawn += amount;

        SERC20(sERC20).transfer(beneficiary, amount);

        emit Withdraw(sERC20, beneficiary, amount);
    }

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
    function withdrawBatch(address[] calldata sERC20s, address beneficiary) external {
        address sERC20;
        uint256 due;
        uint256 withdrawn;

        for (uint256 i = 0; i < sERC20s.length; i++) {
            sERC20 = sERC20s[i];

            Split storage split = _splits[sERC20];
            
            require(split.sERC20 != address(0), "SERC20Splitter: unsplit sERC20");
            
            due =
                (SERC20(sERC20).balanceOf(address(this)) + split.totalWithdrawn) * split.shares[beneficiary] / PCT_BASE;
            withdrawn = split.withdrawn[beneficiary];
            require(due > withdrawn, "SERC20Splitter: nothing to withdraw");
            
            uint256 amount = due - withdrawn;
            split.withdrawn[beneficiary] += amount;
            split.totalWithdrawn += amount;

            SERC20(sERC20).transfer(beneficiary, amount);

            emit Withdraw(sERC20, beneficiary, amount);
        }

    }

    function isRegistered(address sERC20) external view returns (bool) {
        return _splits[sERC20].sERC20 != address(0);
    }

    function splitOf(address sERC20) external view returns (uint256 received, uint256 totalWithdrawn) {
        Split storage split = _splits[sERC20];

        received = SERC20(sERC20).balanceOf(address(this)) + split.totalWithdrawn;
        totalWithdrawn = split.totalWithdrawn;
    }

    function withdrawnBy(address sERC20, address beneficiary) external view returns (uint256) {
        return _splits[sERC20].withdrawn[beneficiary];
    }
}
