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
        sale.pool = pool;
        sale.multiplier = multiplier;
        sale.start = block.timestamp + timelock;
        sale.flash = flash;
    }

    function buyout(address sERC20, address beneficiary) external payable {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Opened, "FlashBroker: invalid sale state");

        uint256 price = _price(sale.pool);
        // uint256 value = _max()
        // uint256 balance =
        // 1* burn the tokens owned by buyer
        // 2* sERC1155.unlock
        sIERC20(sERC20).burn(_msgSender(), sIERC20(sERC20).balanceOf(_msgSender()));
        _sERC1155.unlock(sERC20, beneficiary, "");
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
            address pool,
            uint256 multiplier,
            uint256 start,
            uint256 minimum,
            uint256 price,
            uint256 nbOfProposals,
            bool flash
        )
    {
        Sales.Sale storage sale = _sales[sERC20];

        state = sale.state();
        pool = sale.pool;
        multiplier = sale.multiplier;
        start = sale.start;
        minimum = sale.minimumTokenPrice;
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

    function currentValueOf(address sERC20) public view returns (uint256) {
        Sales.Sale storage sale = _sales[sERC20];

        return _value(sIERC20(sERC20), sale.pool);
    }

    function _value(sIERC20 sERC20, address pool) private view returns (uint256) {
        uint256 multiplier = _sales[address(sERC20)].multiplier;
        uint256 supply = sERC20.totalSupply();
        uint256 balance = sERC20.balanceOf(_msgSender());
        uint256 remaining = supply - balance;
        uint256 price = _price(pool);
        uint256 value = price * remaining * multiplier;
        uint256 minimum = _sales[address(sERC20)].minimumTokenPrice * sERC20.cap() * multiplier;

        if (minimum > value) return minimum;
        else return value;
    }

    function _price(address pool) private view returns (uint256) {
        return 2 * DECIMALS;
    }
}
