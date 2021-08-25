// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interfaces/IBroker.sol";
import "./libraries/Sales.sol";
import "../token/interfaces/sIERC20.sol";
import "../vault/interfaces/IVault.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title Broker
 * @notice Handles the buyout of spectralized ERC721.
 */
contract Broker is Context, AccessControlEnumerable, IBroker {
    using Address for address payable;
    using Proposals for Proposals.Proposal;
    using Sales for Sales.Sale;

    uint256 public constant DECIMALS = 1e18;
    uint256 public constant MINIMUM_TIMELOCK = 1 weeks;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    bytes32 private constant BURN_ROLE = keccak256("BURN_ROLE");

    IVault private immutable _vault;
    // IMarket private immutable _market;
    mapping(sIERC20 => Sales.Sale) private _sales;

    constructor(IVault vault_, address registrar) {
        require(address(vault_) != address(0), "FlashBroker: vault cannot be the zero address");

        _vault = vault_;
        _setupRole(ADMIN_ROLE, _msgSender());
        _setupRole(REGISTER_ROLE, registrar);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(REGISTER_ROLE, ADMIN_ROLE);
    }

    /**
     * @notice Register an NFT to be put on sale.
     * @dev - We do not check neither that `sERC20` is unregistered nor that it actually is an NFT-pegged sERC20 to save gas.
     *        Indeed, only trusted templates, registering sERC20s out of actual NFT spectralizations, are supposed to be granted REGISTER_ROLE.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by templates.
     * @param sERC20 The sERC20 whose pegged NFT is put on sale.
     * @param guardian The account authorized to enable flash buyout and accept / reject proposals otherwise.
     * @param reserve The reserve price above which the NFT can be bought out.
     * @param multiplier The sale's buyout multiplier.
     * @param timelock The period of time after which the sale opens.
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

        require(hasRole(REGISTER_ROLE, _msgSender()), "FlashBroker: must have REGISTER_ROLE to register");
        require(timelock >= MINIMUM_TIMELOCK, "FlashBroker: invalid timelock");
        require(flash || guardian != address(0), "FlashBroker: guardian cannot be the zero address if flash buyout is not enabled");

        sale._state = Sales.State.Pending;
        sale.guardian = guardian;
        sale.reserve = reserve;
        sale.multiplier = multiplier; // le multiplier il est enregistrer dans le market !
        sale.opening = block.timestamp + timelock;

        if (flash) _enableFlashBuyout(sERC20, sale);
    }

    function buyout(sIERC20 sERC20) external payable override {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Opened, "FlashBroker: invalid sale state");

        address buyer = _msgSender();
        (uint256 value, uint256 collateral) = _priceOfFor(sERC20, sale, buyer);

        require(msg.value >= value, "FlashBroker: insufficient value");

        if (sale.flash) {
            _buyout(sERC20, sale, buyer, msg.value, buyer, collateral);
        } else {
            sERC20.transferFrom(buyer, address(this), collateral);
            sale.proposals[sale.nbOfProposals] = Proposals.Proposal({state: Proposals.State.Pending, buyer: buyer, value: msg.value, collateral: collateral});

            emit CreateProposal(sERC20, sale.nbOfProposals++, buyer, msg.value, collateral);
        }
    }

    /**
     * @notice Accept proposal #`proposalId` to buyout the NFT pegged to `sERC20`.
     * @param sERC20 The sERC20 whose pegged NFT was proposed to be bought out.
     * @param proposalId The id of the buyout proposal.
     */
    function acceptProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Sales.Sale storage sale = _sales[sERC20];
        Proposals.Proposal storage proposal = sale.proposals[proposalId];

        require(_msgSender() == sale.guardian, "FlashBroker: must be sale's guardian to accept proposals");
        require(sale.state() == Sales.State.Opened, "FlashBroker: invalid sale state");
        require(proposal.state == Proposals.State.Pending, "FlashBroker: invalid proposal state");

        proposal.state = Proposals.State.Accepted;

        emit AcceptProposal(sERC20, proposalId);

        _buyout(sERC20, sale, proposal.buyer, proposal.value, address(this), proposal.collateral);
    }

    /**
     * @notice Reject proposal #`proposalId` to buyout the NFT pegged to `sERC20`.
     * @param sERC20 The sERC20 whose pegged NFT was proposed to be bought out.
     * @param proposalId The id of the buyout proposal.
     */
    function rejectProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Sales.Sale storage sale = _sales[sERC20];
        Proposals.Proposal storage proposal = sale.proposals[proposalId];

        require(_msgSender() == sale.guardian, "FlashBroker: must be sale's guardian to reject proposal");
        require(proposal.state == Proposals.State.Pending, "FlashBroker: invalid proposal state");

        address buyer = proposal.buyer;
        proposal.state = Proposals.State.Rejected;
        sERC20.transfer(buyer, proposal.collateral);
        payable(buyer).sendValue(proposal.value);

        emit RejectProposal(sERC20, proposalId);
    }

    /**
     * @notice Cancel proposal #`proposalId` to buyout the NFT pegged to `sERC20`.
     * @param sERC20 The sERC20 whose pegged NFT was proposed to be bought out.
     * @param proposalId The id of the buyout proposal.
     */
    function cancelProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Sales.Sale storage sale = _sales[sERC20];
        Proposals.Proposal storage proposal = sale.proposals[proposalId];

        require(_msgSender() == proposal.buyer, "FlashBroker: must be proposal's buyer to cancel proposal");
        require(proposal.state == Proposals.State.Pending, "FlashBroker: invalid proposal state");

        address buyer = proposal.buyer;
        proposal.state = Proposals.State.Cancelled;
        sERC20.transfer(buyer, proposal.collateral);
        payable(buyer).sendValue(proposal.value);

        emit CancelProposal(sERC20, proposalId);
    }

    /**
     * @notice Claim shares of `sERC20`'s buyout.
     * @dev This function is open to re-entrancy for it would be harmless.
     * @param sERC20 The sERC20 whose buyout shares are claimed.
     */
    function claim(sIERC20 sERC20) external override {
        Sales.Sale storage sale = _sales[sERC20];
        address holder = _msgSender();
        uint256 balance = sERC20.balanceOf(holder);

        require(sale.state() == Sales.State.Closed, "FlashBuyout: invalid sale state");
        require(balance > 0, "FlashBuyout: nothing to claim");

        uint256 value = (sale.stock * balance) / sERC20.totalSupply();
        sale.stock -= value;
        sERC20.burn(holder, balance);
        payable(holder).sendValue(value);
    }

    function enableFlashBuyout(sIERC20 sERC20) external override {
        Sales.Sale storage sale = _sales[sERC20];
        Sales.State state = sale.state();

        require(_msgSender() == sale.guardian, "FlashBuyout: must be sale's guardian to enable flash buyout");
        require(state == Sales.State.Pending || state == Sales.State.Opened, "FlashBroker: invalid sale state");
        require(sale.flash, "FlashBuyout: flash buyout already enabled");

        _enableFlashBuyout(sERC20, sale);
    }

    /**
     * @notice Transfer `sERC20s` pegged NFTs to `beneficiaries` with `datas` as ERC721#transfer callback datas.
     * @dev This function is only meant to be used in case of emergency / hacks to move sERC20s pegged NFTs to a safer place.
     * @param sERC20s The sERC20s whose pegged NFT are to escape.
     * @param beneficiaries The addresses escaped NFTs are transferred to.
     * @param datas The ERC721#transfer callback datas.
     */
    function escape(
        sIERC20[] calldata sERC20s,
        address[] calldata beneficiaries,
        bytes[] calldata datas
    ) external override {
        require(hasRole(ADMIN_ROLE, _msgSender()), "FlashBroker: must have ADMIN_ROLE to escape NFTs");
        require(sERC20s.length == beneficiaries.length && sERC20s.length == datas.length, "FlashBroker: parameters lengths mismatch");

        for (uint256 i = 0; i < sERC20s.length; i++) {
            _vault.unlock(sERC20s[i], beneficiaries[i], datas[i]);

            emit Escape(sERC20s[i], beneficiaries[i], datas[i]);
        }
    }

    function vault() public view override returns (address) {
        return address(_vault);
    }

    function proposalFor(sIERC20 sERC20, uint256 proposalId) public view override returns (Proposals.Proposal memory) {
        return _sales[sERC20].proposals[proposalId];
    }

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

    function _enableFlashBuyout(sIERC20 sERC20, Sales.Sale storage sale) private {
        sale.flash = true;

        emit EnableFlashBuyout(sERC20);
    }

    function _buyout(
        sIERC20 sERC20,
        Sales.Sale storage sale,
        address buyer,
        uint256 value,
        address burnFrom,
        uint256 collateral
    ) private {
        sale._state = Sales.State.Closed;
        sale.stock = value;

        sERC20.burn(burnFrom, collateral);
        _vault.unlock(sERC20, buyer, "");

        emit Buyout(sERC20, buyer, value, collateral);
        // we should disable minting once bought-out???
        // it means we need to grant the broker contract the admin role
    }

    function _priceOfFor(
        sIERC20 sERC20,
        Sales.Sale storage sale,
        address buyer
    ) private view returns (uint256 value, uint256 collateral) {
        uint256 supply = sERC20.totalSupply();

        require(supply > 0, "FlashBroker: invalid supply state");

        uint256 tokenPrice = _priceOf(sERC20);
        uint256 marketValue = (((tokenPrice * supply) / DECIMALS) * sale.multiplier) / DECIMALS;
        uint256 reserve = sale.reserve;
        uint256 rawValue = reserve >= marketValue ? reserve : marketValue;

        collateral = sERC20.balanceOf(buyer);
        value = (rawValue * (DECIMALS - (collateral * DECIMALS) / supply)) / DECIMALS;
    }

    function _priceOf(sIERC20 sERC20) private view returns (uint256) {
        return 1e16;
    }
}
