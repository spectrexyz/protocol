// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@spectrexyz/protocol-core/contracts/interfaces/sIERC20.sol";
import "@spectrexyz/protocol-core/contracts/interfaces/sIERC1155.sol";
import "@spectrexyz/protocol-bootstrapping-pool/contracts/interfaces/sIMinter.sol";
import "@spectrexyz/protocol-buyout-flash/contracts/interfaces/sIFlashBuyout.sol";
import "@spectrexyz/protocol-infrastructure/contracts/interfaces/sISplitter.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title  sSplitter
 * @notice Split sERC20s between registered beneficiaries when received.
 */
contract sTemplate is Context, AccessControlEnumerable {
    bytes32 private constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 private constant MINT_ROLE = keccak256("MINT_ROLE");

    sIERC1155     private immutable _sERC1155;
    sIFlashBuyout private immutable _sFlashBuyout;
    sIMinter      private immutable _sMinter;
    sISplitter    private immutable _sSplitter;

    constructor(address sERC1155, address sMinter, address sFlashBuyout) {
        _sERC1155     = sERC1155;
        _sMinter      = sMinter;
        _sFlashBuyout = sFlashBuyout;
    }

    function spectralize(
        address            collection,
        uint256            tokenId,
        string memory      name,
        string memory      symbol,
        uint256            cap,
        uint256            multiplier,
        uint256            timeframe,
        address payable    beneficiary,
        address[] calldata beneficiaries,
        uint256[] calldata shares
    )
        external
    {
        uint256 id     = _sERC1155.spectralize(collection, tokenId, name, symbol, cap, address(this), address(_sFlashBuyout));
        address sERC20 = _sERC1155.sERC20Of(id);
        // grant sERC20 roles
        sIERC20.grantRole(MINT_ROLE, address(sMinter));
        sIERC20.grantRole(BURN_ROLE, address(sFlashBuyout));
        // deploy pool
        //register sERC20 in sSplitter
        _sSplitter.register(sERC20, beneficiaries, shares);
        // register sERC20 in sFlashBuyout
        _sFlashBuyout.register(sERC20, /* to update when pool are ready */ address(this), multiplier, timeframe);
        // register sERC20 in sMinter
        _sMinter.register(sERC20, pool, beneficiary, initialPrice, allocation, fee);


    }
}
