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

import "./libraries/Spectres.sol";
import "../token/sIERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IVault {
    event Fractionalize(IERC721 indexed collection, uint256 indexed tokenId, uint256 indexed id, sIERC20 sERC20, address broker);
    event Unlock(uint256 indexed id, address recipient);

    function fractionalize(
        IERC721 collection,
        uint256 tokenId,
        string memory name,
        string memory symbol,
        uint256 cap,
        address admin,
        address broker
    ) external returns (uint256);

    function unlock(
        sIERC20 sERC20,
        address recipient,
        bytes calldata data
    ) external;

    function setUnavailableURI(string memory unavailableURI_) external;

    function setUnlockedURI(string memory unlockedURI_) external;

    function onERC20Transferred(
        address from,
        address to,
        uint256 amount
    ) external;

    function sERC20Base() external view returns (address);

    function unavailableURI() external view returns (string memory);

    function unlockedURI() external view returns (string memory);

    function isLocked(IERC721 collection, uint256 tokenId) external view returns (bool);

    function tokenTypeOf(IERC721 collection, uint256 tokenId) external view returns (uint256);

    function spectreOf(uint256 id) external view returns (Spectres.Spectre memory);

    function spectreOf(sIERC20 sERC20) external view returns (Spectres.Spectre memory);

    function sERC20Of(uint256 id) external pure returns (sIERC20);
}
