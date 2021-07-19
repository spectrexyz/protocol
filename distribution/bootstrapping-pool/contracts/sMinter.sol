// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/sIERC20.sol";
import "./sBootstrappingPool.sol";
// import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
// import "@openzeppelin/contracts/proxy/Clones.sol";
// import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
// import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
// import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
// import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
// import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
// import "@openzeppelin/contracts/utils/Address.sol";
// import "@openzeppelin/contracts/utils/Context.sol";
// import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@balancer-labs/v2-pool-weighted/contracts/IPriceOracle.sol";
import "hardhat/console.sol";

contract sMinter  {
    address private _bank;
    address private _splitter;
    mapping (address => uint256) private _fees;
    mapping (address => uint256) private _allocations;
    mapping (address => sBootstrappingPool) private _pools;

    function register(address sERC20_, address pool) external {
        _pools[sERC20_] = sBootstrappingPool(pool);
    }

    function mint(sIERC20 sERC20_/*, uint256 value, uint256 expected, address recipient*/) external {
        sBootstrappingPool pool = _pools[address(sERC20_)];

          console.log(pool.getLargestSafeQueryWindow());


        IPriceOracle.OracleAverageQuery[] memory query = new IPriceOracle.OracleAverageQuery[](1);
        query[0] = IPriceOracle.OracleAverageQuery({
          variable: IPriceOracle.Variable.PAIR_PRICE,
          secs: 1 days,
          ago: 0
        });
        try pool.getTimeWeightedAverage(query) returns (uint256[] memory prices) {
          console.log(prices[0]);
        } catch Error(string memory reason) {
          if (equal(reason, "BAL#313")) {
            console.log("THIS IS A FAIL");
          } else {
            revert(reason);
          }
        } catch {
            revert("sMinter: pool oracle reverted");
        }
        // if(pool.getLargestSafeQueryWindow() < 1 days) {
        //   console.log("prout");
        //   console.log(pool.getLargestSafeQueryWindow());
        // }

      
        // query[0].variable = IPriceOracle.Variable.PAIR_PRICE;

        // IPriceOracle
        
        // uint256 price = pool.getTimeWeightedAverage(query)[0];


// enum Variable { PAIR_PRICE, BPT_PRICE, INVARIANT }

// getTimeWeightedAverage(OracleAverageQuery[] memory queries)

    // struct OracleAccumulatorQuery {
    //     Variable variable;
    //     uint256 ago;
    // }

//  struct OracleAverageQuery {
//         Variable variable;
//         uint256 secs;
//         uint256 ago;
//     }

// https://github.com/balancer-labs/balancer-v2-monorepo/blob/df9afcf1bef4926f9b4901ba1ee617f44d4395b3/pkg/pool-utils/contracts/interfaces/IPriceOracle.sol
        
    // - PAIR_PRICE: the price of the tokens in the Pool, expressed as the price of the second token in units of the
    //   first token. For example, if token A is worth $2, and token B is worth $4, the pair price will be 2.0.
    //   Note that the price is computed *including* the tokens decimals. This means that the pair price of a Pool with
    //   DAI and USDC will be close to 1.0, despite DAI having 18 decimals and USDC 6.

        // uint256 amount = pool.getPrice(sERC20) * msg.value
        // sERC20.mint(amount);
        // sERC20.mint(amount * allocation, splitter);
        // fee = _fees[sERC20] * amount / PCT_BASE;
        // toBank = protocolFee * fee / PCT_BASE;
        // toSplit = fee - bank;
        // vault.join(toSplit * reward, none);
        //_vault.join(toSplit * common, broker);

        // pool.deposit

        // on calcule le fee sur le token qui a le plus grand poids puis on calcule pour l'autre.
    }

    // function _mint(address sERC20_, address pool, uint256 value, uint256 price, uint)

    function compare(string memory _a, string memory _b) private returns (int) {
        bytes memory a = bytes(_a);
        bytes memory b = bytes(_b);
        uint minLength = a.length;
        if (b.length < minLength) minLength = b.length;
        //@todo unroll the loop into increments of 32 and do full 32 byte comparisons
        for (uint i = 0; i < minLength; i ++)
            if (a[i] < b[i])
                return -1;
            else if (a[i] > b[i])
                return 1;
        if (a.length < b.length)
            return -1;
        else if (a.length > b.length)
            return 1;
        else
            return 0;
    }

       function equal(string memory _a, string memory _b) private returns (bool) {
        return compare(_a, _b) == 0;
    }
}
