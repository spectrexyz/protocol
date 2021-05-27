// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

library Wrappings {
    enum State {
        Void,
        Locked,
        Unlocked
    }

    struct Wrapping {
        State state;
        address collection;
        uint256 tokenId;
        address owner;
    }
}