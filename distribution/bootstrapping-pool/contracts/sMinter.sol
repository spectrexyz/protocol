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
import "@openzeppelin/contracts/utils/Address.sol";
import "hardhat/console.sol";

contract sMinter  {
    using Address for address payable;

    struct Pit {
        sBootstrappingPool pool;
        bytes32            poolId;
        address payable    beneficiary;
        uint256            initialPrice;
        uint256            allocation;
        uint256            fee;
        bool               sERC20IsToken0;
    }

    uint256 public constant ONE = 1e18;

    address payable private _bank;
    address private _splitter;
    IVault  private _vault;
    uint256 private _protocolFee;
   
    mapping (address => Pit) _pits;

    constructor(address vault, address payable bank, address splitter, uint256 protocolFee) {
        _vault = IVault(vault);
        _bank = bank;
        _splitter = splitter;
        _protocolFee = protocolFee;

    }

    function register(address sERC20_, Pit calldata pit) external {
        _pits[sERC20_] = pit;
        _pits[sERC20_].poolId = pit.pool.getPoolId();
        _pits[sERC20_].sERC20IsToken0 = pit.pool.sERC20IsToken0();
    }

    receive() external payable {
        console.log("Received %s ETH", msg.value);
    }

    // check if on met un nonReentrant

    event Mint(address indexed sERC20, uint256 value, uint256 amount, uint256 protocolFee, uint256 fee);

    function mint(address sERC20, uint256 expected, address payable recipient) external payable {
        require(msg.value != 0, "sMinter: minted value must not be null");

        Pit storage        pit            = _pits[sERC20];
        sBootstrappingPool pool           = pit.pool;
        uint256            initialPrice   = pit.initialPrice;
        bool               sERC20IsToken0 = pit.sERC20IsToken0;


        // (uint256 value, uint256 fee) = _doFees(pit.fee);

        // uint256 protocolFee;
        uint256 price = _price(pool, initialPrice, pit.sERC20IsToken0);
        uint256 protocolFee = msg.value * _protocolFee / ONE;
        uint256 fee = msg.value * pit.fee / ONE;
        uint256 value = msg.value - protocolFee - fee;
        uint256 amount = value * price / ONE;

        // uint256 toPool = _toMint(pool, value, initialPrice, pit.sERC20IsToken0);

        // console.log("Price: %s", price);
        // console.log("ProtocolFee: %s", protocolFee);
        // console.log("MintingFee: %s", fee);
        // console.log("Value: %s", value);
        // console.log("toPool: %s", toPool);
        // console.log("ONE: %s", ONE);


        // _bank.sendValue(protocolFee);
        // sIERC20(sERC20).mint(address(this), toPool);
        // sIERC20(sERC20).approve(address(_vault), toPool);
        // _vault.joinPool{value: fee}(pit.poolId, address(this), _bank, _request(sERC20, pit.pool, toPool, fee, pit.sERC20IsToken0));
        
        // collect protocol fee
        _bank.sendValue(protocolFee);
        // pay beneficiary
        pit.beneficiary.sendValue(value);
        // pool LP reward
        _reward(sERC20, pool, pit.poolId, fee, initialPrice, sERC20IsToken0);
        // mint allocation
        // _allocate();
        // mint recipient tokens
        sIERC20(sERC20).mint(recipient, amount);

        // emit Mint(sERC20, msg.value, amount, protocolFee, fee);

// https://github.com/balancer-labs/balancer-v2-monorepo/blob/df9afcf1bef4926f9b4901ba1ee617f44d4395b3/pkg/pool-utils/contracts/interfaces/IPriceOracle.sol
        
    // - PAIR_PRICE: the price of the tokens in the Pool, expressed as the price of the second token in units of the
    //   first token. For example, if token A is worth $2, and token B is worth $4, the pair price will be 2.0.
    //   Note that the price is computed *including* the tokens decimals. This means that the pair price of a Pool with
    //   DAI and USDC will be close to 1.0, despite DAI having 18 decimals and USDC 6.
   
    }

    function withdraw() external {
        _bank.sendValue(address(this).balance);
    }

    function bank() public view returns (address) {
        return _bank;
    } 

   function _request(address sERC20, sBootstrappingPool pool, uint256 amount, uint256 value, bool sERC20IsToken0) private returns (IVault.JoinPoolRequest memory) {
      IAsset[]  memory assets  = new IAsset[](2);
      uint256[] memory amounts = new uint256[](2);

      BaseWeightedPool.JoinKind kind = pool.totalSupply() > 0 ? BaseWeightedPool.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT : BaseWeightedPool.JoinKind.INIT;

      if (sERC20IsToken0) {
          assets[0] = IAsset(sERC20);
          assets[1] = IAsset(address(0));
          amounts[0] = amount;
          amounts[1] = value;
      } else {
          assets[0] = IAsset(address(0));
          assets[1] = IAsset(sERC20);
          amounts[0] = value;
          amounts[1] = amount;
      }

      return IVault.JoinPoolRequest({
          assets: assets,
          maxAmountsIn: amounts,
          userData: abi.encode(BaseWeightedPool.JoinKind.INIT, amounts), // il faut checker le totalSupply de Pool pour savoir si on fait INIT ou EXACT_TOKENS_IN_FOR_BPT_OUT
          fromInternalBalance: false
    });
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

    // always return sERC20 balance as first balance
    function _balances(bytes32 poolId, bool sERC20IsToken0) private returns (uint256[2] memory) {
        (, uint256[] memory balances, ) = _vault.getPoolTokens(poolId);

        if (sERC20IsToken0)
            return [balances[0], balances[1]];
        else
            return [balances[1], balances[0]];
    }

    function _reward(address sERC20, sBootstrappingPool pool, bytes32 poolId, uint256 value, uint256 initialPrice, bool sERC20IsToken0) private returns (uint256) {
        uint256[2] memory balances = _balances(poolId, sERC20IsToken0);
        uint256 reward;

        if (balances[1] == 0) {
          uint256[] memory weights = pool.getNormalizedWeights();
          console.log("sWeight: %s", sERC20IsToken0 ? weights[0] : weights[1]);
          console.log("eWeight: %s", sERC20IsToken0 ? weights[1] : weights[0]);
          if (sERC20IsToken0) 
            reward = value * initialPrice * weights[0] / (ONE * weights[1]);
          else
            reward = value * initialPrice * weights[1] / (ONE * weights[0]);
        } else {
            reward = (value * balances[0]) / balances[1];
        }

        sIERC20(sERC20).mint(address(this), reward);
        sIERC20(sERC20).approve(address(_vault), reward);
        _vault.joinPool{value: value}(poolId, address(this), _bank, _request(sERC20, pool, reward, value, sERC20IsToken0));
    }
}
