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

library Proposals {
    enum State {
        Null,
        Pending,
        Accepted,
        Rejected,
        Lapsed,
        Withdrawn
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

        if (_state == State.Pending && expiration != 0 && block.timestamp >= expiration) {
            return State.Lapsed;
        } else {
            return _state;
        }
    }
}
