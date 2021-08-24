// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;

library Proposals {
    enum State {
        Null,
        Pending,
        Accepted,
        Rejected,
        Cancelled
    }

    struct Proposal {
        State state;
        address buyer;
        uint256 value;
        uint256 collateral;
    }
}
