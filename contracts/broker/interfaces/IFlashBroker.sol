// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <=0.8.4;

import "../../core/interfaces/sIERC20.sol";
import "../libraries/Sales.sol";

interface IFlashBroker {
    event CreateProposal(sIERC20 indexed sERC20, uint256 indexed proposalId, address indexed buyer, uint256 value, uint256 collateral);
    event AcceptProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event RejectProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event CancelProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event Buyout(sIERC20 indexed sERC20, address indexed buyer, uint256 value, uint256 collateral);
    event EnableFlashBuyout(sIERC20 indexed sERC20);
    event Escape(sIERC20 indexed sERC20, address indexed beneficiary, bytes data);

    function register(
        sIERC20 sERC20,
        address guardian,
        uint256 minimum,
        address pool,
        uint256 multiplier,
        uint256 timelock,
        bool flash
    ) external;

    function buyout(sIERC20 sERC20) external payable;

    function acceptProposal(sIERC20 sERC20, uint256 proposalId) external;

    function rejectProposal(sIERC20 sERC20, uint256 proposalId) external;

    function cancelProposal(sIERC20 sERC20, uint256 proposalId) external;

    function claim(sIERC20 sERC20) external;

    function enableFlashBuyout(sIERC20 sERC20) external;

    function escape(
        sIERC20[] calldata sERC20s,
        address[] calldata beneficiaries,
        bytes[] calldata datas
    ) external;

    function vault() external view returns (address);

    function proposalFor(sIERC20 sERC20, uint256 proposalId) external view returns (Proposals.Proposal memory);

    function saleOf(sIERC20 sERC20)
        external
        view
        returns (
            Sales.State state,
            address guardian,
            uint256 reserve,
            address pool,
            uint256 multiplier,
            uint256 opening,
            uint256 stock,
            uint256 nbOfProposals,
            bool flash
        );
}
