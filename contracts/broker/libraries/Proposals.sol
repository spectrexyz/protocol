// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

library Proposals {
    enum State {
        Null,
        Pending,
        Accepted,
        Rejected,
        Lapsed,
        Cancelled
    }

    struct Proposal {
        State _state;
        address buyer;
        uint256 value;
        uint256 collateral;
        uint256 expiration;
    }

    function state(Proposal storage proposal) internal view returns (State) {
        State _state = proposal._state;
        uint256 expiration = proposal.expiration;

        if (_state == State.Pending && expiration != 0) {
            if (block.timestamp < proposal.expiration) return State.Pending;
            else return State.Lapsed;
        } else {
            return _state;
        }
    }
}
