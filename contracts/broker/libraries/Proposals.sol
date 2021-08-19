// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

library Proposals {
    enum State {
        Null,
        Pending,
        Accepted,
        Rejected,
        Lapsed,
        Cancelled,
        Refunded
    }

    struct Proposal {
        State _state;
        address payable from;
        uint256 value;
        uint256 expiration;
    }

    function state(Proposal storage proposal) internal view returns (State) {
        State _state = proposal._state;

        if (_state == State.Pending && block.timestamp < proposal.expiration) {
            return State.Pending;
        } else {
            return _state;
        }
    }
}
