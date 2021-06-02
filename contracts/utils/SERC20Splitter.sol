// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../core/SERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";


contract SERC20Splitter is Context, AccessControlEnumerable {
    struct Split {
        address sERC20; // more efficient than bool to check if a split has been registered
        uint256 totalWithdrawn;
        mapping (address => uint256) shares;
        mapping (address => uint256) withdrawn;
    }

    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    uint256 public constant PCT_BASE = 1 ether;

    event Register(address indexed sERC20, address[] beneficiaries, uint256[] shares);
    event Withdraw(address indexed sERC20, address indexed beneficiary, uint256 amount);

    mapping (address => Split) _splits;

    constructor(address registrar) { 
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(REGISTER_ROLE, registrar);
    }

    function register(address sERC20, address[] calldata beneficiaries, uint256[] calldata shares) external {
      Split storage split = _splits[sERC20];

      require(hasRole(REGISTER_ROLE, _msgSender()), "SERC20Splitter: must have register role to register");
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

    function withdraw(address sERC20, address beneficiary) external {
        Split storage split = _splits[sERC20];
        
        require(split.sERC20 != address(0), "SERC20Splitter: unsplit sERC20");
        //require(allocations.shares[beneficiary] != 0) // will revert anyhow because of due == withdrawn == 0 => nothing to withdraw
        
        uint256 due = (SERC20(sERC20).balanceOf(address(this)) + split.totalWithdrawn) * split.shares[beneficiary] / PCT_BASE;
        uint256 withdrawn = split.withdrawn[beneficiary];
        require(due > withdrawn, "SERC20Splitter: nothing to withdraw");
        
        uint256 amount = due - withdrawn;
        split.withdrawn[beneficiary] += amount;
        split.totalWithdrawn += amount;

        SERC20(sERC20).transfer(beneficiary, amount);

        emit Withdraw(sERC20, beneficiary, amount);
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
