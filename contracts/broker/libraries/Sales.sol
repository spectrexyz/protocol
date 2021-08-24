// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./Proposals.sol";

library Sales {
    using Proposals for Proposals.Proposal;

    enum State {
        Null,
        Pending,
        Opened,
        Closed
    }

    struct Sale {
        State _state;
        address guardian;
        uint256 reserve;
        address pool;
        uint256 multiplier;
        uint256 opening;
        uint256 stock;
        uint256 nbOfProposals;
        mapping(uint256 => Proposals.Proposal) proposals;
        bool flash;
    }

    function state(Sale storage sale) internal view returns (State) {
        State _state = sale._state;

        if (_state == State.Pending && block.timestamp >= sale.opening) {
            return State.Opened;
        } else {
            return _state;
        }
    }
}
