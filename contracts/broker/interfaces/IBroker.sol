// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../libraries/Sales.sol";
import {IForge} from "../../market/interfaces/IForge.sol";
import "../../token/interfaces/sIERC20.sol";
import "../../vault/interfaces/IVault.sol";

interface IBroker {
    event Register(sIERC20 indexed sERC20, address indexed guardian, uint256 reserve, uint256 multiplier, uint256 opening);
    event CreateProposal(sIERC20 indexed sERC20, uint256 indexed proposalId, address indexed buyer, uint256 value, uint256 collateral, uint256 expiration);
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
        uint256 multiplier,
        uint256 timelock,
        bool flash
    ) external;

    function buyout(sIERC20 sERC20) external payable;

    function createProposal(sIERC20 sERC20, uint256 lifespan) external payable returns (uint256);

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

    function vault() external view returns (IVault);

    function forge() external view returns (IForge);

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
            bool flash
        );
}
