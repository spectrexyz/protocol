// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity 0.8.9;

import "./Proposals.sol";

library Sales {
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
        uint256 multiplier;
        uint256 opening;
        uint256 stock;
        uint256 nbOfProposals;
        mapping(uint256 => Proposals.Proposal) proposals;
        bool flash;
        bool escape;
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
