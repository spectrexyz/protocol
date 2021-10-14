// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

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
