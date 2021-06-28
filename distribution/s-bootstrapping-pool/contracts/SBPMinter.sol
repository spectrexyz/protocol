// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

// import "../core/SERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

/**
 * @title sERC1155
 * @notice sERC1155 token wrapping ERC721s into sERC20s.
 * @dev sERC1155 does not implement mint nor burn in an effort to maintain some separation of concerns between
 *      financial / monetary primitives - handled by sERC20s - and display / collectible primitives - handled by the
 *      sERC1155. Let's note that the ERC1155 standard does not require neither mint nor burn functions.
 */
contract SBPMinter is Context, AccessControlEnumerable {
    address                      private _bank;
    address                      private _splitter;
    mapping (address => address) private _pools;
    mapping (address => uint256) private _fees;
    mapping (address => uint256) private _allocations;

    function mint(address /*SERC20*/ sERC20, uint256 value, uint256 expected, address recipient) external {
        address pool = _pools[address(sERC20)];


        
        // uint256 amount = pool.getPrice(sERC20) * msg.value
        // sERC20.mint(amount);
        // sERC20.mint(amount * allocation, splitter);
        // fee = _fees[sERC20] * amount / PCT_BASE;
        // toBank = protocolFee * fee / PCT_BASE;
        // toSplit = fee - bank;
        // vault.join(toSplit * reward, none);
        //_vault.join(toSplit * common, broker);

        // pool.deposit
    }
}