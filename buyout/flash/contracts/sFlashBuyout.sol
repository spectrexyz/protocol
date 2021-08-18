// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interfaces/sIFlashBuyout.sol";
import "./libraries/Sales.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@spectrexyz/protocol-core/contracts/interfaces/sIERC20.sol";
import "@spectrexyz/protocol-core/contracts/interfaces/sIERC1155.sol";
import "hardhat/console.sol";

/**
 * @title sERC1155
 * @notice sERC1155 token wrapping ERC721s into sERC20s.
 * @dev sERC1155 does not implement mint nor burn in an effort to maintain some separation of concerns between
 *      financial / monetary primitives - handled by sERC20s - and display / collectible primitives - handled by the
 *      sERC1155. Let's note that the ERC1155 standard does not require neither mint nor burn functions.
 */
contract sFlashBuyout is Context, AccessControlEnumerable, sIFlashBuyout {
    using Address for address payable;
    using Sales   for Sales.Sale;

    uint256   public constant DECIMALS     = 1e18;
    uint256   public constant MINIMUM_LOCK = 1 weeks;

    sIERC1155                        immutable private _sERC1155;
    mapping(address => Sales.Sale)             private _sales;

    constructor(address sERC1155) {
        require(sERC1155 != address(0), "sFlashBuyout: sERC1155 cannot be the zero address");

        _sERC1155 = sIERC1155(sERC1155);
    }

    function register(address sERC20, address pool, uint256 multiplier, uint256 timeframe) external override {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Null, "sFlashBuyout: sERC20 already registered");
        // do we check that the NFT is actually locked by the sERC1155 or not ?
        // if not, lets protect the operation with a REGISTER_ROLE

        sale._state      = Sales.State.Pending;
        sale.pool       = pool;
        sale.multiplier = multiplier;
        sale.start      = block.timestamp + timeframe;



    }

    function buyout(address sERC20, address beneficiary) external payable {
        Sales.Sale storage sale = _sales[sERC20];

        require(sale.state() == Sales.State.Opened, "sFlashBuyout: invalid sale state");

        uint256 price = _price(sale.pool);
        // uint256 value = _max()
        // uint256 balance = 
        // 1* burn the tokens owned by buyer
        // 2* sERC1155.unlock
        sIERC20(sERC20).burnFrom(_msgSender(), sIERC20(sERC20).balanceOf(_msgSender()));
        _sERC1155.unlock(sERC20, beneficiary, "");
    }

    /**
     * @dev This function can be re-entered but this would cause no harm.
     */
    function claim(address sERC20, address account, address payable beneficiary) external payable {
        Sales.Sale storage sale = _sales[sERC20];
        uint256 balance         = sIERC20(sERC20).balanceOf(account);
        
        require(sale.state() == Sales.State.Closed, "sFlashBuyout: invalid sale state");
        require(balance       > 0                  , "sFlashBuyout: nothing to claim");

        sIERC20(sERC20).burnFrom(account, balance);
        beneficiary.sendValue(sale.price * balance);
    }

    function _value(sIERC20 sERC20, address pool) private returns (uint256) {
        uint256 multiplier = _sales[address(sERC20)].multiplier;
        uint256 supply   = sERC20.totalSupply();
        uint256 balance  = sERC20.balanceOf(_msgSender());
        uint256 remaining = supply - balance;
        uint256 price    = _price(pool);
        uint256 value    =  price * remaining * multiplier;
        uint256 minimum  = _sales[address(sERC20)].minimumTokenPrice * sERC20.cap() * multiplier ;

        if (minimum > value)
            return minimum;
        else
            return value;
    }

    function _price(address pool) private returns (uint256) {
        return 2 * DECIMALS;
    }

}
