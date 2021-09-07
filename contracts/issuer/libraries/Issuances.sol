// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../interfaces/ISpectralizationBootstrappingPool.sol";
import "./Proposals.sol";

library Issuances {
    enum State {
        Null,
        Opened,
        Closed
    }

    struct Issuance {
        State state;
        ISpectralizationBootstrappingPool pool;
        bytes32 poolId;
        address guardian;
        uint256 reserve;
        uint256 allocation;
        uint256 fee;
        uint256 nbOfProposals;
        mapping(uint256 => Proposals.Proposal) proposals;
        bool flash;
        bool poolIsRegular;
    }
}
