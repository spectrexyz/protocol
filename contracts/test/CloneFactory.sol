// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";


contract CloneFactory {
    using Clones for address;

    event Clone(address proxy);

    function clone(address implementation) external {
        emit Clone(implementation.clone());
    }
}