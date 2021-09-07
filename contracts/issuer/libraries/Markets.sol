// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../interfaces/ISpectralizationBootstrappingPool.sol";
import "./Proposals.sol";

library Markets {
    enum State {
        Null,
        Opened,
        Closed
    }

    struct Market {
        State state;
        ISpectralizationBootstrappingPool pool;
        bytes32 poolId;
        uint256 sERC20Index; // index of the sERC20 token in the SBP [0 or 1]
        address payable guardian; // guardian ?
        uint256 reserve;
        uint256 allocation;
        uint256 fee;
        uint256 nbOfProposals;
        mapping(uint256 => Proposals.Proposal) proposals;
        bool flash;
    }
}
