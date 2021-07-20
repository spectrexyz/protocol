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
import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";

import "@balancer-labs/v2-pool-weighted/contracts/IPriceOracle.sol";
import "@balancer-labs/v2-pool-weighted/contracts/BaseWeightedPool.sol";


import "hardhat/console.sol";

contract sMinter  {
    struct Pit {
        sBootstrappingPool pool;
        bytes32 poolId;
        // address beneficiary;
        uint256 initialPrice;
        uint256 allocation;
        uint256 fee;
        bool sERC20IsToken0;
    }

    uint256 public constant ONE = 1e18;

    address private _bank;
    address private _splitter;
    IVault  private _vault;
    uint256 private _protocolFee;
    mapping (address => uint256) private _fees;
    mapping (address => uint256) private _allocations;
    mapping (address => sBootstrappingPool) private _pools;
    mapping (address => Pit) _pits;

    constructor(address vault, uint256 protocolFee) {
        _vault = IVault(vault);
        _protocolFee = protocolFee;
    }

    function register(address sERC20_, Pit calldata pit) external {
        _pits[sERC20_] = pit;
        _pits[sERC20_].poolId = pit.pool.getPoolId();
        _pits[sERC20_].sERC20IsToken0 = pit.pool.sERC20IsToken0();
    }

    function mint(address sERC20_/*, uint256 value, uint256 expected, address recipient*/) external payable {
        Pit storage pit = _pits[sERC20_];

        uint256 price = _price(pit.pool, pit.initialPrice, pit.sERC20IsToken0);
        uint256 protocolFee = msg.value * _protocolFee / ONE;
        uint256 fee = msg.value * pit.fee / ONE;
        uint256 value = msg.value - protocolFee - fee;
        uint256 amount = msg.value * price / ONE;
        // uint256 fee = pit.fee * amount / ONE;

        uint256 toPool = _toMint(pit.pool, value, pit.initialPrice, pit.sERC20IsToken0);

        console.log("Price: %s", price);
        console.log("ProtocolFee: %s", protocolFee);
        console.log("MintingFee: %s", fee);
        console.log("Value: %s", value);
        console.log("toPool: %s", toPool);


        // IAsset[]  memory assets  = new IAsset[](2);
        // uint256[] memory amounts = new uint256[](2);

        // if (pit.sERC20IsToken0) {
        //     assets[0] = IAsset(sERC20_);
        //     assets[1] = IAsset(address(0));
        //     amounts[0] = toPool;
        //     amounts[1] = fee;
        // } else {
        //     assets[0] = IAsset(address(0));
        //     assets[1] = IAsset(sERC20_);
        //     amounts[0] = fee;
        //     amounts[1] = toPool;
        // }

        

        // IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
        //     assets: assets,
        //     maxAmountsIn: amounts,
        //     userData: abi.encode(BaseWeightedPool.JoinKind.INIT, amounts), // il faut checker le totalSupply de Pool pour savoir si on fait INIT ou EXACT_TOKENS_IN_FOR_BPT_OUT
        //     fromInternalBalance: false
        // });


        // sIERC20(sERC20_).mint(address(this), toPool);
        // sIERC20(sERC20_).approve(address(_vault), toPool);
        // _vault.joinPool{value: value}(pit.poolId, address(this), address(this), request);


        // 1. On prend un fee sur l'ETH pour nous.
        // 2. On prend un fee sur l'ETH pour le minting.
        // 3. On mint en supplément ce qu'il faut pour la pool
        // 4. On mint ce qu'il faut pour l'acheteur
        // 5. On mint l'allocation
        // 6. On join / reward.


// https://github.com/balancer-labs/balancer-v2-monorepo/blob/df9afcf1bef4926f9b4901ba1ee617f44d4395b3/pkg/pool-utils/contracts/interfaces/IPriceOracle.sol
        
    // - PAIR_PRICE: the price of the tokens in the Pool, expressed as the price of the second token in units of the
    //   first token. For example, if token A is worth $2, and token B is worth $4, the pair price will be 2.0.
    //   Note that the price is computed *including* the tokens decimals. This means that the pair price of a Pool with
    //   DAI and USDC will be close to 1.0, despite DAI having 18 decimals and USDC 6.
   
    }

   

    function _price(sBootstrappingPool pool, uint256 initialPrice, bool sERC20IsToken0) private returns (uint256) {
        IPriceOracle.OracleAverageQuery[] memory query = new IPriceOracle.OracleAverageQuery[](1);
        query[0] = IPriceOracle.OracleAverageQuery({
            variable: IPriceOracle.Variable.PAIR_PRICE,
            secs: 1 days,
            ago: 0
        });

        try pool.getTimeWeightedAverage(query) returns (uint256[] memory prices) {
          return sERC20IsToken0 ? prices[0] : ONE * ONE / prices[0]; // return in sERC20 per ETH;
        } catch Error(string memory reason) {
          if (keccak256(bytes(reason)) == keccak256(bytes("BAL#313"))) {
            return initialPrice;
          } else {
            revert(reason);
          }
        } catch {
            revert("sMinter: pool oracle reverted");
        }
    }

    function _toMint(sBootstrappingPool pool, uint256 value, uint256 initialPrice, bool sERC20IsToken0) private returns (uint256) {
        (, uint256[] memory balances, ) = _vault.getPoolTokens(pool.getPoolId());
        // uint256[] memory weights = pool.getNormalizedWeights();

        uint256 sBalance;
        uint256 eBalance;
        // uint256 sWeight;
        // uint256 eWeight;

        if (sERC20IsToken0) {
            sBalance = balances[0];
            eBalance = balances[1];
            // sWeight = weights[0];
            // eWeight = weights[1];
        } else {
            sBalance = balances[1];
            eBalance = balances[0];
            // sWeight = weights[1];
            // eWeight = weights[0];
        }
        
        // console.log("sWeight: %s", sWeight);
        // console.log("eWeight: %s", eWeight);
        console.log("sBalance: %s", sBalance);
        console.log("eBalance: %s", eBalance);

        // uint256 price = (eBalance * sWeight) / (sBalance * eWeight);

        if (eBalance == 0) {
          uint256[] memory weights = pool.getNormalizedWeights();
          console.log("sWeight: %s", sERC20IsToken0 ? weights[0] : weights[1]);
          console.log("eWeight: %s", sERC20IsToken0 ? weights[1] : weights[0]);
          if (sERC20IsToken0) 
            return value * initialPrice * weights[0] / (ONE * weights[1]);
          else
            return value * initialPrice * weights[1] / (ONE * weights[0]);
          // return value * initialPrice * sWeight / eWeight;
        } else {
          return (value * sBalance) / eBalance;
        }

        
        // SP = (B_0 * w_1) / (B_1 * w_0)
        // amount = (value * sWeight) / (price * eWeight);

     }

    // function _fee(sBootstrappingPool pool, uint256 IProtocolFeesCollector) private returns (uint256 value, uint256 amount) {
    //     bool sERC20IsToken0 = pool.sERC20IsToken0();
    //     uint256 maxWeightTokenIndex = pool.maxWeightTokenIndex();
    //     if (sERC20isToken0 && maxWeightTokenIndex == 0)
    //         return 
    // }


}
