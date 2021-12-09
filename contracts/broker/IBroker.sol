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

import "./libraries/Sales.sol";
import {IIssuer} from "../issuer/IIssuer.sol";
import "../token/sIERC20.sol";
import "../vault/IVault.sol";

interface IBroker {
    event Register(sIERC20 indexed sERC20, address indexed guardian, uint256 reserve, uint256 multiplier, uint256 opening);
    event CreateProposal(sIERC20 indexed sERC20, uint256 indexed proposalId, address indexed buyer, uint256 value, uint256 collateral, uint256 expiration);
    event AcceptProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event RejectProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event WithdrawProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event Claim(sIERC20 indexed sERC20, address indexed holder, uint256 value, uint256 collateral);
    event Buyout(sIERC20 indexed sERC20, address indexed buyer, uint256 value, uint256 collateral, uint256 fee);
    event EnableFlashBuyout(sIERC20 indexed sERC20);
    event EnableEscape(sIERC20 indexed sERC20);
    event DisableEscape(sIERC20 indexed sERC20);
    event SetReserve(sIERC20 indexed sERC20, uint256 reserve);
    event SetBank(address bank);
    event SetProtocolFee(uint256 protocolFee);
    event Escape(sIERC20 indexed sERC20, address indexed beneficiary, bytes data);

    function register(
        sIERC20 sERC20,
        address guardian,
        uint256 minimum,
        uint256 multiplier,
        uint256 timelock,
        bool flash,
        bool escape,
        bool cap
    ) external;

    function buyout(sIERC20 sERC20) external payable;

    function createProposal(sIERC20 sERC20, uint256 lifespan) external payable returns (uint256);

    function acceptProposal(sIERC20 sERC20, uint256 proposalId) external;

    function rejectProposal(sIERC20 sERC20, uint256 proposalId) external;

    function withdrawProposal(sIERC20 sERC20, uint256 proposalId) external;

    function claim(sIERC20 sERC20) external;

    function enableFlashBuyout(sIERC20 sERC20) external;

    function enableEscape(sIERC20 sERC20) external;

    function disableEscape(sIERC20 sERC20) external;

    function setReserve(sIERC20 sERC20, uint256 reserve) external;

    function setBank(address bank_) external;

    function setProtocolFee(uint256 protocolFee_) external;

    function _escape_(
        sIERC20[] calldata sERC20s,
        address[] calldata beneficiaries,
        bytes[] calldata datas
    ) external;

    function vault() external view returns (IVault);

    function issuer() external view returns (IIssuer);

    function bank() external view returns (address);

    function protocolFee() external view returns (uint256);

    function priceOfFor(sIERC20 sERC20, address buyer) external view returns (uint256 value, uint256 collateral);

    function saleOf(sIERC20 sERC20)
        external
        view
        returns (
            Sales.State state,
            address guardian,
            uint256 reserve,
            uint256 multiplier,
            uint256 opening,
            uint256 stock,
            uint256 nbOfProposals,
            bool flash,
            bool escape,
            bool cap
        );

    function proposalFor(sIERC20 sERC20, uint256 proposalId)
        external
        view
        returns (
            Proposals.State state,
            address buyer,
            uint256 value,
            uint256 collateral,
            uint256 expiration
        );
}
