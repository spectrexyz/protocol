// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../../core/interfaces/sIERC20.sol";

interface IFlashBroker {
    event CreateProposal(sIERC20 indexed sERC20, uint256 indexed proposalId, address buyer, address beneficiary, uint256, uint256 balance, uint256 expiration);
    event AcceptProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event RejectProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event CancelProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event EnableBuyout();

    function register(
        sIERC20 sERC20,
        address guardian,
        uint256 minimum,
        address pool,
        uint256 multiplier,
        uint256 timelock,
        bool flash
    ) external;
}
