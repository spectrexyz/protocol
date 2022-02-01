// SPDX-License-Identifier: GPL-3.0
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
import "../interfaces/IFractionalizationBootstrappingPool.sol";

library Issuances {
    enum State {
        Null,
        Opened,
        Closed
    }

    struct Issuance {
        State state;
        address guardian;
        IFractionalizationBootstrappingPool pool;
        bytes32 poolId;
        uint256 reserve;
        uint256 allocation;
        uint256 fee;
        uint256 nbOfProposals;
        mapping(uint256 => Proposals.Proposal) proposals;
        bool flash;
        bool sERC20IsToken0;
    }
}
