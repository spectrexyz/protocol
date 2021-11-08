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

import "../broker/IBroker.sol";
import {IIssuer} from "../issuer/IIssuer.sol";
import "../utils/ISplitter.sol";
import "../vault/IVault.sol";
import "../token/sIERC20.sol";
import "../token/sIERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IChanneler {
    struct FractionalizationData {
        address guardian;
        string name;
        string symbol;
        uint256 cap;
        uint256 buyoutReserve;
        uint256 multiplier;
        uint256 timelock;
        uint256 sMaxNormalizedWeight;
        uint256 sMinNormalizedWeight;
        address[] beneficiaries;
        uint256[] shares;
        uint256 swapFeePercentage;
        uint256 issuanceReserve;
        uint256 fee;
        bool buyoutFlash;
        bool issuanceFlash;
    }

    function mintAndFractionalize(string memory _tokenURI, FractionalizationData calldata data) external;

    function fractionalize(
        IERC721 collection,
        uint256 tokenId,
        FractionalizationData calldata data
    ) external;

    function pause() external;

    function unpause() external;

    function sERC721() external view returns (sIERC721);

    function vault() external view returns (IVault);

    function issuer() external view returns (IIssuer);

    function broker() external view returns (IBroker);

    function splitter() external view returns (ISplitter);
}
