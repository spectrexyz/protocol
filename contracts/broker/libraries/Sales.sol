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
        address pool;
        uint256 multiplier;
        uint256 start;
        uint256 minimumTokenPrice; // in ETH per sERC20
        uint256 price; // in ETH per SERC20
        uint256 nbOfProposals;
        mapping(uint256 => Proposals.Proposal) proposals;
        bool flash;
    }

    function propose(
        Sale storage sale,
        address payable from,
        uint256 value,
        uint256 expiration
    ) internal returns (uint256) {
        sale.proposals[sale.nbOfProposals] = Proposals.Proposal({_state: Proposals.State.Pending, from: from, value: value, expiration: expiration});
        sale.nbOfProposals++;
    }

    function accept(Sale storage sale, uint256 id) internal {
        Proposals.Proposal storage proposal = sale.proposals[id];

        require(proposal.state() == Proposals.State.Pending, "FlashBroker: invalid proposal state");

        proposal._state = Proposals.State.Accepted;
    }

    function reject(Sale storage sale, uint256 id) internal {
        Proposals.Proposal storage proposal = sale.proposals[id];

        require(proposal.state() == Proposals.State.Pending, "FlashBroker: invalid proposal state");

        proposal._state = Proposals.State.Rejected;
    }

    function cancel(Sale storage sale, uint256 id) internal {
        Proposals.Proposal storage proposal = sale.proposals[id];

        require(proposal.state() == Proposals.State.Pending, "FlashBroker: invalid proposal state");

        proposal._state = Proposals.State.Cancelled;
    }

    function refund(Sale storage sale, uint256 id) internal {
        Proposals.Proposal storage proposal = sale.proposals[id];

        require(proposal.state() == Proposals.State.Lapsed || proposal.state() == Proposals.State.Rejected, "FlashBroker: invalid proposal state");

        proposal._state = Proposals.State.Refunded;
    }

    function state(Sale storage sale) internal view returns (State) {
        State _state = sale._state;

        if (_state == State.Pending && block.timestamp >= sale.start) {
            return State.Opened;
        } else {
            return _state;
        }
    }
}
