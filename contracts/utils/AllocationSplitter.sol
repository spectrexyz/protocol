// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../core/SERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract AllocationSplitter is Context, AccessControlEnumerable {
    struct Allocation {
        bool exists;
        uint256 received;
        uint256 withdrawn;
        mapping (address => uint256) shares;
        mapping (address => uint256) withdrawnBy;
    }

    bytes32 public constant ALLOCATE_ROLE = keccak256("ALLOCATE_ROLE");
    uint256 public constant PCT_BASE = 1 ether;

    event Allocate (address indexed token, address[] beneficiaries, address[] shares);
    event Withdraw (address indexed token, address indexed beneficiary, uint256 amount);

    mapping (address => Allocation) _allocations;

    constructor(address allocator) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ALLOCATE_ROLE, allocator);
    }

    function allocationOf(address token) public view returns (bool exists, uint256 received, uint256 withdrawn) {
        Allocation storage allocation = _allocations[token];
        
        uint256 balance = SERC20(token).balanceOf(address(this));

        exists = allocation.exists;
        received = balance + allocation.withdrawn;
        withdrawn = allocation.withdrawn;
    }

    function withdrawnBy(address token, address beneficiary) public view returns (uint256) {
        return _allocations[token].withdrawnBy[beneficiary];
    }

    function allocate(address token, address[] calldata beneficiaries, uint256[] calldata shares) external {
      require(hasRole(ALLOCATE_ROLE, _msgSender()), "AllocationSplitter: must have allocate role to allocate");
      require(beneficiaries.length == shares.length, "AllocationSplitter: beneficiaries and shares length mismatch");

      Allocation storage allocation = _allocations[token];
      require(!allocation.exists, "AllocationSplitter: allocation already exists");
      
      allocation.exists = true;
      for (uint256 i = 0; i < beneficiaries.length; i++) {
          allocation.shares[beneficiaries[i]] = shares[i];
        console.log("FBeneficiary: %s", beneficiaries[i]);
        console.log("shares: %s", shares[i]);


      }
    }

    function withdraw(address token) external {
        Allocation storage allocation = _allocations[token];
        address beneficiary = _msgSender();

        _poke(token, allocation);

        uint256 due = allocation.received * allocation.shares[beneficiary] / PCT_BASE;
        uint256 withdrawn = allocation.withdrawnBy[beneficiary];
        require(due > withdrawn, "AllocationSplitter: nothing to withdraw");
        
        uint256 amount = due - withdrawn;
        allocation.withdrawnBy[beneficiary] += amount;
        allocation.withdrawn += amount;

        console.log("Withdrawing: %s", amount);
        console.log("For: %s", beneficiary);
        console.log("========");

        SERC20(token).transfer(beneficiary, amount);

        emit Withdraw(token, beneficiary, amount);
    }

    function _poke(address token, Allocation storage allocation) private {
        uint256 balance = SERC20(token).balanceOf(address(this));
        allocation.received = balance + allocation.withdrawn;

        console.log("Received: %s", allocation.received);
        console.log("Withdrawn: %s", allocation.withdrawn);

        console.log("========");
    }

}
