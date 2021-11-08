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

pragma solidity ^0.8.0;

import "../issuer/IIssuer.sol";
import "../token/sIERC20.sol";

contract IssuerMock {
    event Close(sIERC20 indexed sERC20);

    function twapOf(sIERC20, IIssuer.TwapKind) external pure returns (uint256) {
        return 2e18; // 2 ETH per sERC20
    }

    function close(sIERC20 sERC20) external {
        emit Close(sERC20);
    }
}
