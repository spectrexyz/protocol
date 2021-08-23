// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interfaces/IFlashBroker.sol";
import "./libraries/Sales.sol";
import "../core/interfaces/sIERC20.sol";
import "../core/interfaces/sIERC1155.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "hardhat/console.sol";

contract FlashBroker is Context, AccessControlEnumerable, IFlashBroker {
    using Address for address payable;
    using Sales for Sales.Sale;
    using Proposals for Proposals.Proposal;

    uint256 public constant DECIMALS = 1e18;
    uint256 public constant MINIMUM_TIMELOCK = 1 weeks;
    uint256 public constant PROPOSAL_DURATION = 1 weeks;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 private constant BURN_ROLE = keccak256("BURN_ROLE");

    sIERC1155 private immutable _sERC1155;
    mapping(sIERC20 => Sales.Sale) private _sales;

    constructor(sIERC1155 sERC1155_) {
        require(address(sERC1155_) != address(0), "FlashBroker: sERC1155 cannot be the zero address");

        _sERC1155 = sERC1155_;
        _setupRole(ADMIN_ROLE, _msgSender());
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
    }

    function register(
        sIERC20 sERC20,
        address guardian,
        uint256 minimum,
        address pool,
        uint256 multiplier,
        uint256 timelock,
        bool flash
    ) external override {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Null, "FlashBroker: sERC20 already registered");
        require(_sERC1155.spectreOf(address(sERC20)).state == sIERC1155.SpectreState.Locked, "FlashBroker: invalid spectre state");
        require(timelock >= MINIMUM_TIMELOCK, "FlashBroker: invalid timelock");

        sale._state = Sales.State.Pending;
        sale.guardian = guardian;
        sale.minimum = minimum;
        sale.pool = pool;
        sale.multiplier = multiplier;
        sale.opening = block.timestamp + timelock;
        sale.flash = flash;
    }

    function buyout(sIERC20 sERC20, address beneficiary) external payable {
        Sales.Sale storage sale = _sales[sERC20];
        address buyer = _msgSender();

        require(sale.state() == Sales.State.Opened, "FlashBroker: invalid sale state");
        (uint256 price, uint256 supply, uint256 balance) = _priceOfFor(sERC20, sale, _msgSender());
        require(msg.value >= price, "FlashBroker: insufficient value");

        if (sale.flash) {
            _buyout(sIERC20(sERC20), sale, _msgSender(), beneficiary, supply, balance);
        } else {
            sIERC20(sERC20).transferFrom(buyer, address(this), balance);
            uint256 expiration = block.timestamp + PROPOSAL_DURATION;
            sale.proposals[sale.nbOfProposals] = Proposals.Proposal({
                _state: Proposals.State.Pending,
                buyer: buyer,
                beneficiary: beneficiary,
                value: msg.value,
                balance: balance,
                expiration: expiration
            });
            emit CreateProposal(sERC20, sale.nbOfProposals++, buyer, beneficiary, msg.value, balance, expiration);
            // check that it updates the number of proposals
        }
    }

    function proposal(sIERC20 sERC20, uint256 proposalId)
        public
        view
        returns (
            Proposals.State state,
            address buyer,
            address beneficiary,
            uint256 value,
            uint256 balance,
            uint256 expiration
        )
    {
        Proposals.Proposal storage proposal = _sales[sERC20].proposals[proposalId];

        state = proposal.state();
        buyer = proposal.buyer;
        beneficiary = proposal.beneficiary;
        value = proposal.value;
        balance = proposal.balance;
        expiration = proposal.expiration;
    }

    function accept(sIERC20 sERC20, uint256 proposalId) external {
        Sales.Sale storage _sale = _sales[sERC20];
        Proposals.Proposal storage _proposal = _sale.proposals[proposalId];

        require(_msgSender() == _sale.guardian, "FlashBroker: must be a sale's guardian to accept proposals");
        require(_proposal.state() == Proposals.State.Pending, "FlashBroker: invalid proposal state");

        address beneficiary = _proposal.beneficiary;
        uint256 supply = sIERC20(sERC20).totalSupply();
        uint256 balance = sIERC20(sERC20).balanceOf(beneficiary);

        // _buyout(sIERC20(sERC20), sale, _msgSender(), beneficiary, supply, balance);
        _proposal._state = Proposals.State.Accepted;
        _sale._state = Sales.State.Closed;
        _sale.price = supply > balance ? (_proposal.value * DECIMALS) / (supply - balance) : 0;
        sERC20.burn(balance);
        _sERC1155.unlock(address(sERC20), beneficiary, "");

        emit AcceptProposal(sERC20, proposalId);
        // emit Buyout(sERC20, buyer, beneficiary, value, balance);
        // _buyout
    }

    function reject(sIERC20 sERC20, uint256 proposalId) external {
        Sales.Sale storage _sale = _sales[sERC20];
        Proposals.Proposal storage _proposal = _sale.proposals[proposalId];

        require(_proposal.state() == Proposals.State.Pending, "FlashBroker: invalid proposal state");
        require(_msgSender() == _sale.guardian, "FlashBroker: must be guardian to reject proposal");

        _proposal._state = Proposals.State.Rejected;
        sERC20.transfer(_proposal.buyer, _proposal.balance);
        payable(_proposal.buyer).sendValue(_proposal.value);

        emit RejectProposal(sERC20, proposalId);
    }

    function cancel(sIERC20 sERC20, uint256 proposalId) external {
        Sales.Sale storage _sale = _sales[sERC20];
        Proposals.Proposal storage _proposal = _sale.proposals[proposalId];

        require(_proposal.state() == Proposals.State.Pending, "FlashBroker: invalid proposal state");
        require(_msgSender() == _proposal.buyer, "FlashBroker: must be buyer to cancel proposal");

        _proposal._state = Proposals.State.Cancelled;
        sERC20.transfer(_proposal.buyer, _proposal.balance);
        payable(_proposal.buyer).sendValue(_proposal.value);

        emit CancelProposal(sERC20, proposalId);
    }

    /**
     * @dev This function can be re-entered but this would cause no harm.
     */
    function claim(
        sIERC20 sERC20,
        address account,
        address payable beneficiary
    ) external {
        Sales.Sale storage sale = _sales[sERC20];
        uint256 balance = sIERC20(sERC20).balanceOf(account);

        require(sale.state() == Sales.State.Closed, "sFlashBuyout: invalid sale state");
        require(balance > 0, "sFlashBuyout: nothing to claim");

        sIERC20(sERC20).burn(account, balance);
        beneficiary.sendValue(sale.price * balance);
    }

    function enableBuyout(sIERC20 sERC20) external {
        Sales.Sale storage _sale = _sales[sERC20];

        require(_msgSender() == _sale.guardian, "FlashBuyout: must be guardian to enable flash buyout");
        require(_sale.flash, "FlashBuyout: flash buyout already enabled");

        _enableBuyout(_sale);
    }

    function escape(
        address[] calldata sERC20s,
        address[] calldata beneficiaries,
        bytes[] calldata datas
    ) external {
        require(hasRole(ADMIN_ROLE, _msgSender()), "FlashBroker: must have ADMIN_ROLE to escape NFTs");
        require(sERC20s.length == beneficiaries.length && sERC20s.length == datas.length, "FlashBroker: parameters lengths do not match");

        for (uint256 i = 0; i < sERC20s.length; i++) {
            _sERC1155.unlock(sERC20s[i], beneficiaries[i], datas[i]);
        }
    }

    function sERC1155() public view returns (address) {
        return address(_sERC1155);
    }

    function saleOf(sIERC20 sERC20)
        public
        view
        returns (
            Sales.State state,
            address guardian,
            uint256 minimum,
            address pool,
            uint256 multiplier,
            uint256 opening,
            uint256 price,
            uint256 nbOfProposals,
            bool flash
        )
    {
        Sales.Sale storage sale = _sales[sERC20];

        state = sale.state();
        guardian = sale.guardian;
        minimum = sale.minimum;
        pool = sale.pool;
        multiplier = sale.multiplier;
        opening = sale.opening;
        price = sale.price;
        nbOfProposals = sale.nbOfProposals;
        flash = sale.flash;
    }

    function priceOf(sIERC20 sERC20) public view returns (uint256) {
        Sales.Sale storage sale = _sales[sERC20];

        return _priceOf(sERC20, sale);
    }

    function _priceOf(sIERC20 sERC20, Sales.Sale storage sale) private view returns (uint256) {
        uint256 minimum = sale.minimum;
        uint256 multiplier = sale.multiplier;
        uint256 supply = sIERC20(sERC20).totalSupply();
        uint256 price = _priceOf(sale.pool);
        uint256 value = price * supply * multiplier;

        if (minimum > value) return minimum;
        else return value;
    }

    function _enableBuyout(Sales.Sale storage _sale) private {
        _sale.flash = true;

        emit EnableBuyout();
    }

    function _buyout(
        sIERC20 sERC20,
        Sales.Sale storage sale,
        address buyer,
        address beneficiary,
        uint256 supply,
        uint256 balance
    ) private {
        sale._state = Sales.State.Closed;
        sale.price = supply > balance ? (msg.value * DECIMALS) / (supply - balance) : 0;
        sERC20.burn(buyer, balance);
        _sERC1155.unlock(address(sERC20), beneficiary, "");
        // we should disable minting once bought-out???
        // it means we need to grant the broker contract the admin role
    }

    // we don't need to return value, only price
    // we may rename it valueOfFor to enforce value = overall price, price = price per token
    function _priceOfFor(
        sIERC20 sERC20,
        Sales.Sale storage sale,
        address buyer
    )
        private
        view
        returns (
            uint256 price,
            uint256 supply,
            uint256 balance
        )
    {
        balance = sIERC20(sERC20).balanceOf(buyer);
        supply = sIERC20(sERC20).totalSupply();

        require(supply > 0, "FlashBroker: invalid supply state");

        uint256 tokenPrice = _priceOf(sale.pool);
        uint256 marketValue = (((tokenPrice * supply) / DECIMALS) * sale.multiplier) / DECIMALS;
        uint256 minimum = sale.minimum;
        uint256 value = minimum >= marketValue ? minimum : marketValue;

        price = (value * (DECIMALS - (balance * DECIMALS) / supply)) / DECIMALS;

        // 250
        // 1000 .03 250 * 0.03

        // 0.04
    }

    function _priceOf(address pool) private view returns (uint256) {
        return 1e16;
    }
}
