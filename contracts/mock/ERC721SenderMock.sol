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

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract ERC721SenderMock {
    function supportsInterface(bytes4) public pure returns (bool) {
        return false;
    }

    function onERC721Received(IERC721Receiver to, bytes calldata data) external {
        to.onERC721Received(address(0), address(0), 0, data);
    }
}
