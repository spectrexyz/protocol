// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./IChanneler.sol";
import "../broker/IBroker.sol";
import {IIssuer} from "../issuer/IIssuer.sol";
import "../utils/ISplitter.sol";
import "../vault/IVault.sol";
import "../token/sIERC20.sol";
import "../token/sIERC721.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title Channeler
 * @notice Wraps all the transactions needed to fractionalize an NFT into one atomic transaction.
 */
contract Channeler is Context, AccessControlEnumerable, Pausable, IChanneler {
    bytes32 private constant MINT_ROLE = keccak256("MINT_ROLE");

    sIERC721 private immutable _sERC721;
    IVault private immutable _vault;
    IIssuer private immutable _issuer;
    IBroker private immutable _broker;
    ISplitter private immutable _splitter;

    constructor(
        address sERC721_,
        address vault_,
        address issuer_,
        address broker_,
        address splitter_
    ) {
        require(sERC721_ != address(0), "Channeler: sERC721 cannot be the zero address");
        require(vault_ != address(0), "Channeler: vault cannot be the zero address");
        require(issuer_ != address(0), "Channeler: issuer cannot be the zero address");
        require(broker_ != address(0), "Channeler: broker cannot be the zero address");
        require(splitter_ != address(0), "Channeler: splitter cannot be the zero address");

        _sERC721 = sIERC721(sERC721_);
        _vault = IVault(vault_);
        _issuer = IIssuer(issuer_);
        _broker = IBroker(broker_);
        _splitter = ISplitter(splitter_);
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function mintAndFractionalize(string memory _tokenURI, FractionalizationData calldata data) external override whenNotPaused {
        uint256 tokenId = _sERC721.mint(_msgSender(), _tokenURI);
        fractionalize(IERC721(_sERC721), tokenId, data);
    }

    function fractionalize(
        IERC721 collection,
        uint256 tokenId,
        FractionalizationData calldata data
    ) public override whenNotPaused {
        sIERC20 sERC20 = _fractionalize(collection, tokenId, data.name, data.symbol, data.cap);
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

    function pause() external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Channeler: must have DEFAULT_ADMIN_ROLE to pause");

        _pause();
    }

    function unpause() external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Channeler: must have DEFAULT_ADMIN_ROLE to unpause");

        _unpause();
    }

    function sERC721() public view override returns (sIERC721) {
        return _sERC721;
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
