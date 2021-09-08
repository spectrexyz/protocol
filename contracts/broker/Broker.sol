// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./IBroker.sol";
import "./libraries/Proposals.sol";
import "./libraries/Sales.sol";
import {IIssuer} from "../issuer/IIssuer.sol";
import "../token/sIERC20.sol";
import "../vault/IVault.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title Broker
 * @notice Handles the buyout of fractionalized NFTs.
 */
contract Broker is Context, AccessControlEnumerable, IBroker {
    using Address for address payable;
    using Proposals for Proposals.Proposal;
    using Sales for Sales.Sale;

    bytes32 public constant ESCAPE_ROLE = keccak256("ESCAPE_ROLE");
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    uint256 public constant MINIMUM_TIMELOCK = 1 weeks;
    uint256 public constant DECIMALS = 1e18; // !IMPORTANT: is the same as Issuer.DECIMALS
    bytes32 private constant _MINT_ROLE = keccak256("MINT_ROLE");

    IVault private immutable _vault;
    IIssuer private immutable _issuer;
    mapping(sIERC20 => Sales.Sale) private _sales;

    constructor(IVault vault_, IIssuer issuer_) {
        require(address(vault_) != address(0), "Broker: vault cannot be the zero address");
        require(address(issuer_) != address(0), "Broker: issuer cannot be the zero address");

        _vault = vault_;
        _issuer = issuer_;
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @notice Put the NFT pegged to `sERC20` on sale.
     * @dev - We do not check neither that `sERC20` is unregistered nor that it actually is an sERC20 to save gas.
     *      - Indeed, only trusted templates, registering sERC20s out of actual NFT fractionalizations, are supposed to be granted REGISTER_ROLE.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by templates.
     * @param sERC20 The sERC20 whose pegged NFT is put on sale.
     * @param guardian The account authorized to enable flash buyout and accept / reject proposals otherwise.
     * @param reserve The reserve price above which the NFT can be bought out.
     * @param multiplier The sale's buyout multiplier [expressed with 1e18 decimals].
     * @param timelock The period of time after which the sale opens [in seconds].
     * @param flash True if flash buyout is enabled, false otherwise.
     */
    function register(
        sIERC20 sERC20,
        address guardian,
        uint256 reserve,
        uint256 multiplier,
        uint256 timelock,
        bool flash
    ) external override {
        Sales.Sale storage sale = _sales[sERC20];

        require(hasRole(REGISTER_ROLE, _msgSender()), "Broker: must have REGISTER_ROLE to register");
        require(timelock >= MINIMUM_TIMELOCK, "Broker: invalid timelock");
        require(flash || guardian != address(0), "Broker: guardian cannot be the zero address if flash buyout is disabled");

        sale._state = Sales.State.Pending;
        sale.guardian = guardian;
        sale.reserve = reserve;
        sale.multiplier = multiplier;
        sale.opening = block.timestamp + timelock;

        emit Register(sERC20, guardian, reserve, multiplier, block.timestamp + timelock);

        if (flash) _enableFlashBuyout(sERC20, sale);
    }

    /**
     * @notice Buyout the NFT pegged to `sERC20`.
     * @dev This function requires flash buyout to be enabled.
     * @param sERC20 The sERC20 whose pegged NFT is boughtout.
     */
    function buyout(sIERC20 sERC20) external payable override {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Opened, "Broker: invalid sale state");
        require(sale.flash, "Broker: flash buyout is disabled");

        address buyer = _msgSender();
        (uint256 value, uint256 collateral) = _priceOfFor(sERC20, sale, buyer);

        require(msg.value >= value, "Broker: insufficient value");

        _buyout(sERC20, sale, buyer, msg.value, collateral, false);
    }

    /**
     * @notice Create a proposal to buyout the NFT pegged to `sERC20`.
     * @param sERC20 The sERC20 whose pegged NFT is proposed to be bought out.
     * @param lifespan The lifespan of the proposal [in seconds].
     */
    function createProposal(sIERC20 sERC20, uint256 lifespan) external payable override returns (uint256) {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Opened, "Broker: invalid sale state");
        require(!sale.flash, "Broker: flash buyout is enabled");

        address buyer = _msgSender();
        (uint256 value, uint256 collateral) = _priceOfFor(sERC20, sale, buyer);

        require(msg.value >= value, "Broker: insufficient value");

        if (collateral > 0) sERC20.transferFrom(buyer, address(this), collateral);

        uint256 proposalId = sale.nbOfProposals++;
        uint256 expiration = lifespan == 0 ? 0 : block.timestamp + lifespan;
        sale.proposals[proposalId] = Proposals.Proposal({
            _state: Proposals.State.Pending,
            buyer: buyer,
            value: msg.value,
            collateral: collateral,
            expiration: expiration
        });

        emit CreateProposal(sERC20, proposalId, buyer, msg.value, collateral, expiration);

        return proposalId;
    }

    /**
     * @notice Accept proposal #`proposalId` to buyout the NFT pegged to `sERC20`.
     * @param sERC20 The sERC20 whose pegged NFT was proposed to be bought out.
     * @param proposalId The id of the buyout proposal.
     */
    function acceptProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Sales.Sale storage sale = _sales[sERC20];
        Proposals.Proposal storage proposal = sale.proposals[proposalId];

        require(_msgSender() == sale.guardian, "Broker: must be sale's guardian to accept proposals");
        require(sale.state() == Sales.State.Opened, "Broker: invalid sale state");
        require(proposal.state() == Proposals.State.Pending, "Broker: invalid proposal state");
        require(!sale.flash, "Broker: flash buyout is enabled");

        proposal._state = Proposals.State.Accepted;

        emit AcceptProposal(sERC20, proposalId);

        _buyout(sERC20, sale, proposal.buyer, proposal.value, proposal.collateral, true);
    }

    /**
     * @notice Reject proposal #`proposalId` to buyout the NFT pegged to `sERC20`.
     * @dev This function is open to re-entrancy for it would be harmless.
     * @param sERC20 The sERC20 whose pegged NFT was proposed to be bought out.
     * @param proposalId The id of the buyout proposal.
     */
    function rejectProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Sales.Sale storage sale = _sales[sERC20];
        Proposals.Proposal storage proposal = sale.proposals[proposalId];
        Proposals.State state = proposal.state();

        require(_msgSender() == sale.guardian, "Broker: must be sale's guardian to reject proposal");
        require(state == Proposals.State.Pending || state == Proposals.State.Lapsed, "Broker: invalid proposal state");

        address buyer = proposal.buyer;
        proposal._state = Proposals.State.Rejected;
        sERC20.transfer(buyer, proposal.collateral);
        payable(buyer).sendValue(proposal.value);

        emit RejectProposal(sERC20, proposalId);
    }

    /**
     * @notice Withdraw proposal #`proposalId` to buyout the NFT pegged to `sERC20`.
     * @dev This function is open to re-entrancy for it would be harmless.
     * @param sERC20 The sERC20 whose pegged NFT was proposed to be bought out.
     * @param proposalId The id of the buyout proposal.
     */
    function withdrawProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Sales.Sale storage sale = _sales[sERC20];
        Proposals.Proposal storage proposal = sale.proposals[proposalId];
        Proposals.State state = proposal.state();

        require(_msgSender() == proposal.buyer, "Broker: must be proposal's buyer to withdraw proposal");
        require(state == Proposals.State.Pending || state == Proposals.State.Lapsed, "Broker: invalid proposal state");

        address buyer = proposal.buyer;
        proposal._state = Proposals.State.Withdrawn;
        sERC20.transfer(buyer, proposal.collateral);
        payable(buyer).sendValue(proposal.value);

        emit WithdrawProposal(sERC20, proposalId);
    }

    /**
     * @notice Claim shares of the buyout of the NFT pegged to `sERC20`.
     * @dev This function is open to re-entrancy for it would be harmless.
     * @param sERC20 The sERC20 whose buyout shares are claimed.
     */
    function claim(sIERC20 sERC20) external override {
        Sales.Sale storage sale = _sales[sERC20];
        address holder = _msgSender();
        uint256 balance = sERC20.balanceOf(holder);

        require(sale.state() == Sales.State.Closed, "Broker: invalid sale state");
        require(balance > 0, "Broker: nothing to claim");

        uint256 value = (sale.stock * balance) / sERC20.totalSupply();
        sale.stock -= value;
        sERC20.burnFrom(holder, balance);
        payable(holder).sendValue(value);

        emit Claim(sERC20, holder, value, balance);
    }

    /**
     * @notice Enable flash buyout for the NFT pegged to `sERC20`.
     * @param sERC20 The sERC20 whose pegged NFT is to be offered to flash buyout.
     */
    function enableFlashBuyout(sIERC20 sERC20) external override {
        Sales.Sale storage sale = _sales[sERC20];
        Sales.State state = sale.state();

        require(_msgSender() == sale.guardian, "Broker: must be sale's guardian to enable flash buyout");
        require(state == Sales.State.Pending || state == Sales.State.Opened, "Broker: invalid sale state");
        require(!sale.flash, "Broker: flash buyout already enabled");

        _enableFlashBuyout(sERC20, sale);
    }

    /**
     * @notice Transfer all the NFTs pegged to `sERC20s `to `beneficiaries` with `datas` as ERC721#safeTransferFrom callback datas.
     * @dev This function is only meant to be used in case of an emergency or upgrade to transfer NFTs to a safer or up-to-date place.
     * @param sERC20s The sERC20s whose pegged NFTs are transferred.
     * @param beneficiaries The addresses escaped NFTs are transferred to.
     * @param datas The ERC721#transfer callback datas.
     */
    function escape(
        sIERC20[] calldata sERC20s,
        address[] calldata beneficiaries,
        bytes[] calldata datas
    ) external override {
        require(hasRole(ESCAPE_ROLE, _msgSender()), "Broker: must have ESCAPE_ROLE to escape NFTs");
        require(sERC20s.length == beneficiaries.length && sERC20s.length == datas.length, "Broker: parameters lengths mismatch");

        for (uint256 i = 0; i < sERC20s.length; i++) {
            _vault.unlock(sERC20s[i], beneficiaries[i], datas[i]);

            emit Escape(sERC20s[i], beneficiaries[i], datas[i]);
        }
    }

    /**
     * @notice Return the broker's vault.
     */
    function vault() public view override returns (IVault) {
        return _vault;
    }

    /**
     * @notice Return the broker's issuer.
     */
    function issuer() public view override returns (IIssuer) {
        return _issuer;
    }

    /**
     * @notice Return what it costs for `buyer` to buyout the NFT pegged to `sERC20`.
     */
    function priceOfFor(sIERC20 sERC20, address buyer) public view override returns (uint256 value, uint256 collateral) {
        return _priceOfFor(sERC20, _sales[sERC20], buyer);
    }

    /**
     * @notice Return the proposal #`proposalId` to buyout the NFT pegged to `sERC20`.
     */
    function proposalFor(sIERC20 sERC20, uint256 proposalId)
        public
        view
        override
        returns (
            Proposals.State state,
            address buyer,
            uint256 value,
            uint256 collateral,
            uint256 expiration
        )
    {
        Proposals.Proposal storage proposal = _sales[sERC20].proposals[proposalId];

        state = proposal.state();
        buyer = proposal.buyer;
        value = proposal.value;
        collateral = proposal.collateral;
        expiration = proposal.expiration;
    }

    /**
     * @notice Return the sale of the NFT pegged to `sERC20`.
     */
    function saleOf(sIERC20 sERC20)
        public
        view
        override
        returns (
            Sales.State state,
            address guardian,
            uint256 reserve,
            uint256 multiplier,
            uint256 opening,
            uint256 stock,
            uint256 nbOfProposals,
            bool flash
        )
    {
        Sales.Sale storage sale = _sales[sERC20];

        state = sale.state();
        guardian = sale.guardian;
        reserve = sale.reserve;
        multiplier = sale.multiplier;
        opening = sale.opening;
        stock = sale.stock;
        nbOfProposals = sale.nbOfProposals;
        flash = sale.flash;
    }

    function _buyout(
        sIERC20 sERC20,
        Sales.Sale storage sale,
        address buyer,
        uint256 value,
        uint256 collateral,
        bool locked
    ) private {
        sale._state = Sales.State.Closed;
        sale.stock = value;
        _issuer.close(sERC20);

        if (collateral > 0) {
            if (locked) sERC20.burn(collateral);
            else sERC20.burnFrom(buyer, collateral);
        }

        _vault.unlock(sERC20, buyer, "");

        emit Buyout(sERC20, buyer, value, collateral);
    }

    function _enableFlashBuyout(sIERC20 sERC20, Sales.Sale storage sale) private {
        sale.flash = true;

        emit EnableFlashBuyout(sERC20);
    }

    function _priceOfFor(
        sIERC20 sERC20,
        Sales.Sale storage sale,
        address buyer
    ) private view returns (uint256 value, uint256 collateral) {
        collateral = sERC20.balanceOf(buyer);
        uint256 supply = sERC20.totalSupply();
        uint256 marketValue = (((_issuer.twapOf(sERC20) * supply) / DECIMALS) * sale.multiplier) / DECIMALS;
        uint256 reserve = sale.reserve;
        uint256 rawValue = reserve >= marketValue ? reserve : marketValue;

        value = supply > 0 ? (rawValue * (DECIMALS - (collateral * DECIMALS) / supply)) / DECIMALS : rawValue;
    }
}
