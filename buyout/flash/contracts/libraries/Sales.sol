// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;


library Sales {
    enum State {
        Null,
        Pending,
        Opened,
        Closed
    }

    struct Sale {
        State   _state;
        address pool;
        uint256 multiplier;
        uint256 start;
        uint256 minimumTokenPrice; // in ETH per sERC20
        uint256 price;             // in ETH per SERC20
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

