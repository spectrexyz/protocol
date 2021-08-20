// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interfaces/IFlashBroker.sol";
import "./libraries/Sales.sol";
import "../core/interfaces/sIERC20.sol";
import "../core/interfaces/sIERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "hardhat/console.sol";

contract FlashBroker is Context, IFlashBroker {
    using Address for address payable;
    using Sales for Sales.Sale;

    uint256 public constant DECIMALS = 1e18;
    uint256 public constant MINIMUM_TIMELOCK = 1 weeks;
    bytes32 private constant BURN_ROLE = keccak256("BURN_ROLE");

    sIERC1155 private immutable _sERC1155;
    mapping(address => Sales.Sale) private _sales;

    constructor(address vault) {
        require(vault != address(0), "FlashBroker: vault cannot be the zero address");

        _sERC1155 = sIERC1155(vault);

    }

    function register(
        address sERC20,
        address guardian,
        uint256 minimum,
        address pool,
        uint256 multiplier,
        uint256 timelock,
        bool flash
    ) external override {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Null, "FlashBroker: sERC20 already registered");
        require(_sERC1155.spectreOf(sERC20).state == sIERC1155.SpectreState.Locked, "FlashBroker: invalid spectre state");
        require(timelock >= MINIMUM_TIMELOCK, "FlashBroker: invalid timelock");

        sale._state = Sales.State.Pending;
        sale.guardian = guardian;
        sale.minimum = minimum;
        sale.pool = pool;
        sale.multiplier = multiplier;
        sale.opening = block.timestamp + timelock;
        sale.flash = flash;
    }

    function buyout(address sERC20, address beneficiary) external payable {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Opened, "FlashBroker: invalid sale state");
        (uint256 value, uint256 price, uint256 supply, uint256 balance) = _priceOfFor(sERC20, sale, _msgSender());
        console.log("Price: %s", price);
        require(msg.value >= price, "FlashBroker: insufficient value");

        if (sale.flash) {
            _buyout(sIERC20(sERC20), sale, _msgSender(), beneficiary, value, supply, balance);
        }

        
    }

    function _buyout(sIERC20 sERC20, Sales.Sale storage sale, address buyer, address beneficiary, uint256 value, uint256 supply, uint256 balance) private {
        sale._state = Sales.State.Closed;
        sale.price  = supply > balance ? value / (supply - balance) : 0;
        sERC20.burn(buyer, balance);
        _sERC1155.unlock(address(sERC20), beneficiary, "");
    }
 
    /**
     * @dev This function can be re-entered but this would cause no harm.
     */
    function claim(
        address sERC20,
        address account,
        address payable beneficiary
    ) external payable {
        Sales.Sale storage sale = _sales[sERC20];
        uint256 balance = sIERC20(sERC20).balanceOf(account);

        require(sale.state() == Sales.State.Closed, "sFlashBuyout: invalid sale state");
        require(balance > 0, "sFlashBuyout: nothing to claim");

        sIERC20(sERC20).burnFrom(account, balance);
        beneficiary.sendValue(sale.price * balance);
    }

    function sERC1155() public view returns (address) {
        return address(_sERC1155);
    }

    function saleOf(address sERC20)
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
        //         State _state;
        // address pool;
        // uint256 multiplier;
        // uint256 start;
        // uint256 minimumTokenPrice; // in ETH per sERC20
        // uint256 price; // in ETH per SERC20
        // uint256 nbOfProposals;
        // mapping (uint256 => Proposals.Proposal) proposals;
        // bool    flash;
    }

    function priceOf(address sERC20) public view returns (uint256) {
        Sales.Sale storage sale = _sales[sERC20];

        return _priceOf(sERC20, sale);
    }

    function _priceOf(address sERC20, Sales.Sale storage sale) private view returns (uint256) {
        uint256 minimum = sale.minimum;
        uint256 multiplier = sale.multiplier;
        uint256 supply = sIERC20(sERC20).totalSupply();
        uint256 price = _priceOf(sale.pool);
        uint256 value = price * supply * multiplier;

        if (minimum > value) return minimum;
        else return value;
    }

    function _priceOfFor(address sERC20, Sales.Sale storage sale, address buyer) private view returns (uint256 value, uint256 price, uint256 supply, uint256 balance) {
        balance = sIERC20(sERC20).balanceOf(buyer);
        supply = sIERC20(sERC20).totalSupply();
        
        uint256 tokenPrice = _priceOf(sale.pool);
        uint256 marketValue = tokenPrice * supply / DECIMALS * sale.multiplier / DECIMALS;        
        uint256 minimum = sale.minimum;

        value = minimum >= marketValue ? minimum : marketValue;
        price = supply == 0 ? value : value * ( DECIMALS - balance * DECIMALS / supply) / DECIMALS;
        // 750
        // 2250
        // cap = 1000
        // minted = 250 + 250 = 500
        // price = 2
        // MarketCap = 500 * 0.01 = 5 
        // multiplier = 1.5
        // MarketValue = MarketCap * multiplier = 7.5 
     
        // to pay = 1 / 2 * 2250 = 750
    }

    function _priceOf(address pool) private view returns (uint256) {
        return 1e16;
    }
}
