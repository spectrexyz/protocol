// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

library Spectres {
    enum State {
        Null,
        Locked,
        Unlocked
    }

    struct Spectre {
        State state;
        IERC721 collection;
        uint256 tokenId;
        address broker;
    }
}
