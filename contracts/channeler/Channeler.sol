// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./IChanneler.sol";
import "../broker/IBroker.sol";
import {IIssuer} from "../issuer/IIssuer.sol";
import "../utils/ISplitter.sol";
import "../vault/IVault.sol";
import "../token/sIERC20.sol";

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title Channeler
 * @notice Wraps all the transaction needed to fractionalize an NFT into an atomic one.
 */
contract Channeler is Context, AccessControlEnumerable, Pausable, IChanneler {
    bytes32 private constant MINT_ROLE = keccak256("MINT_ROLE");

    IVault private immutable _vault;
    IIssuer private immutable _issuer;
    IBroker private immutable _broker;
    ISplitter private immutable _splitter;

    constructor(
        address vault_,
        address issuer_,
        address broker_,
        address splitter_
    ) {
        require(vault_ != address(0), "Channeler: vault cannot be the zero address");
        require(issuer_ != address(0), "Channeler: issuer cannot be the zero address");
        require(broker_ != address(0), "Channeler: broker cannot be the zero address");
        require(splitter_ != address(0), "Channeler: splitter cannot be the zero address");

        _vault = IVault(vault_);
        _issuer = IIssuer(issuer_);
        _broker = IBroker(broker_);
        _splitter = ISplitter(splitter_);
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function fractionalize(FractionalizationData calldata data) external override whenNotPaused {
        sIERC20 sERC20 = _fractionalize(data.collection, data.tokenId, data.name, data.symbol, data.cap);
        uint256 allocation = _splitter.register(sERC20, data.beneficiaries, data.shares);
        _broker.register(sERC20, data.guardian, data.buyoutReserve, data.multiplier, data.timelock, data.buyoutFlash, true);
        _issuer.register(
            sERC20,
            data.guardian,
            data.sMaxNormalizedWeight,
            data.sMinNormalizedWeight,
            data.swapFeePercentage,
            data.issuanceReserve,
            allocation,
            data.fee,
            data.issuanceFlash
        );
        sIERC20(sERC20).grantRole(MINT_ROLE, address(_issuer));
    }

    function pause() external override whenNotPaused {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Channeler: must have DEFAULT_ADMIN_ROLE to pause channeler");

        _pause();
    }

    function unpause() external override whenPaused {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Channeler: must have DEFAULT_ADMIN_ROLE to unpause channeler");

        _unpause();
    }

    function vault() public view override returns (IVault) {
        return _vault;
    }

    function issuer() public view override returns (IIssuer) {
        return _issuer;
    }

    function broker() public view override returns (IBroker) {
        return _broker;
    }

    function splitter() public view override returns (ISplitter) {
        return _splitter;
    }

    function _fractionalize(
        IERC721 collection,
        uint256 tokenId,
        string memory name,
        string memory symbol,
        uint256 cap
    ) private returns (sIERC20) {
        uint256 id = _vault.fractionalize(collection, tokenId, name, symbol, cap, address(this), address(_broker));
        return _vault.sERC20Of(id);
    }
}
