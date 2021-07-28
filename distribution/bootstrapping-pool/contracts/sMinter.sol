// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./interfaces/sIERC20.sol";
import "./interfaces/sIMinter.sol";
import "./sBootstrappingPool.sol"; // pass it as an interface or directly as a BaseWeightPoolTwotokens
import "@balancer-labs/v2-pool-weighted/contracts/IPriceOracle.sol";
import "@balancer-labs/v2-pool-weighted/contracts/BaseWeightedPool.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol" as OZMath;
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract sMinter is Context, AccessControl, sIMinter {
    using Address         for address payable;
    using OZMath.SafeMath for uint256;

    bytes32 public constant ADMIN_ROLE    = keccak256("ADMIN_ROLE");
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    uint256 public constant DECIMALS      = 1e18;
    uint256 public constant HUNDRED       = 1e20;

    modifier protected() {
        require(hasRole(ADMIN_ROLE, _msgSender()), "sMinter: protected operation");
        _;
    }

    IVault  immutable        private _vault;
    address payable          private _bank;
    address                  private _splitter;
    uint256                  private _protocolFee;
    mapping (address => Pit) private _pits;

    constructor(address vault, address payable bank, address splitter, uint256 protocolFee) {
        require(vault      != address(0), "sMinter: vault cannot be the zero address");
        require(bank       != address(0), "sMinter: bank cannot be the zero address");
        require(splitter   != address(0), "sMinter: splitter cannot be the zero address");
        require(protocolFee < HUNDRED,    "sMinter: protocol fee must be inferior to 100%");

        _vault       = IVault(vault);
        _bank        = bank;
        _splitter    = splitter;
        _protocolFee = protocolFee;

        _setupRole(ADMIN_ROLE, _msgSender());
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(REGISTER_ROLE, ADMIN_ROLE);
    }

    // check if on met un nonReentrant
    function mint(address sERC20, uint256 expected, address payable recipient) external payable override {
        Pit storage pit                   = _pits[sERC20];
        sBootstrappingPool pool           = pit.pool;
        bytes32            poolId         = pit.poolId;
        uint256            initialPrice   = pit.initialPrice;
        bool               sERC20IsToken0 = pit.sERC20IsToken0;

        require(poolId != bytes32(0), "sMinter: no pit registered for sERC20");
        require(msg.value  != 0,          "sMinter: minted value must not be null");
        require(recipient  != address(0), "sMinter: recipient cannot be the zero address");

        

        uint256 price       = _price(pool, initialPrice, sERC20IsToken0);
        uint256 protocolFee = (msg.value.mul(pit.protocolFee)).div(HUNDRED);
        uint256 fee         = (msg.value.mul(pit.fee)).div(HUNDRED);
        uint256 value       = msg.value.sub(protocolFee).sub(fee);
        uint256 amount      = (value.mul(price)).div(DECIMALS);

        require(amount >= expected, "sMinter: insufficient minting return");

        // collect protocol fee
        _bank.sendValue(protocolFee);
        // pay beneficiary
        pit.beneficiary.sendValue(value);
        // pool LP reward
        uint256 reward = _doReward(sERC20, pool, poolId, fee, initialPrice, sERC20IsToken0);
        // mint recipient tokens
        sIERC20(sERC20).mint(recipient, amount);
        // mint allocation tokens
        sIERC20(sERC20).mint(_splitter, _allocation(pit.allocation, amount.add(reward)));

        emit Mint(sERC20, recipient, msg.value, amount);
    }

    function register(address sERC20, address pool, address payable beneficiary, uint256 initialPrice, uint256 allocation, uint256 fee) external override {
        uint256 protocolFee = _protocolFee;

        require(hasRole(REGISTER_ROLE, _msgSender()),        "sMinter: must have REGISTER_ROLE to register");        
        require(_pits[sERC20].poolId == bytes32(0),          "sMinter: pit already registered");
        require(address(pool)        != address(0),          "sMinter: pool cannot be the zero address");
        require(beneficiary          != payable(address(0)), "sMinter: beneficiary cannot be the zero address");
        require(initialPrice         != 0,                   "sMinter: initial price cannot be null");
        require(allocation            < HUNDRED,             "sMinter: allocation must be inferior to 100%");
        require(fee.add(protocolFee)  < HUNDRED,             "sMinter: cumulated fees must be inferior to 100%");

        _pits[sERC20].pool           = sBootstrappingPool(pool);
        _pits[sERC20].beneficiary    = beneficiary;
        _pits[sERC20].initialPrice   = initialPrice;
        _pits[sERC20].allocation     = allocation;
        _pits[sERC20].fee            = fee;
        _pits[sERC20].protocolFee    = protocolFee;
        _pits[sERC20].poolId         = sBootstrappingPool(pool).getPoolId();
        _pits[sERC20].sERC20IsToken0 = sBootstrappingPool(pool).sERC20IsToken0();

        emit Register(sERC20, pool, address(beneficiary), initialPrice, allocation, fee, protocolFee);
    }

    function withdraw(address token) external override {
        if (token == address(0)) {
            _bank.sendValue(address(this).balance);
        } else {
            sIERC20(token).transfer(_bank, sIERC20(token).balanceOf(address(this)));
        }
    }
  
  /* #region setters */
    function setBank(address payable bank) external override protected {
        require(bank != address(0), "sMinter: bank cannot be the zero address");

        _bank = bank;
    }

    function setSplitter(address splitter) external override protected {
        require(splitter != address(0), "sMinter: splitter cannot be the zero address");

        _splitter = splitter;
    } 

    function setProtocolFee(uint256 protocolFee) external override protected {
        require(protocolFee < HUNDRED, "sMinter: protocol fee must be inferior to 100%");

        _protocolFee = protocolFee;
    }
  /* #endregion*/

  /* #region getters */
    function vault() public view override returns (IVault) {
        return _vault;
    } 
    
    function bank() public view override returns (address) {
        return _bank;
    }

    function splitter() public view override returns (address) {
        return _splitter;
    } 

    function protocolFee() public view override returns (uint256) {
        return _protocolFee;
    }

    function pitOf(address sERC20) public view override returns (Pit memory) {
        return _pits[sERC20];
    }
  /* #endregion*/

  /* #region private */
    function _request(address sERC20, sBootstrappingPool pool, uint256 amount, uint256 value, bool sERC20IsToken0) private view returns (IVault.JoinPoolRequest memory) {
        IAsset[]  memory assets  = new IAsset[](2);
        uint256[] memory amounts = new uint256[](2);

        if (sERC20IsToken0) {
            assets[0]  = IAsset(sERC20);
            assets[1]  = IAsset(address(0));
            amounts[0] = amount;
            amounts[1] = value;
        } else {
            assets[0]  = IAsset(address(0));
            assets[1]  = IAsset(sERC20);
            amounts[0] = value;
            amounts[1] = amount;
        }

        return pool.totalSupply() > 0 ?
            IVault.JoinPoolRequest({
                assets:              assets,
                maxAmountsIn:        amounts,
                userData:            abi.encode(uint256(3), amounts),
                fromInternalBalance: false
            }) :
            IVault.JoinPoolRequest({
                assets:              assets,
                maxAmountsIn:        amounts,
                userData:            abi.encode(BaseWeightedPool.JoinKind.INIT, amounts),
                fromInternalBalance: false
            });
    }

    /**
     * @dev - This function always returns the price in sERC20 per ETH [see PriceOracle.sol for details].
     *      - This function do not care about decimals as both ETH and sERC20s have 18 decimals.
     */
    function _price(sBootstrappingPool pool, uint256 initialPrice, bool sERC20IsToken0) private view returns (uint256) {
        IPriceOracle.OracleAverageQuery[] memory query = new IPriceOracle.OracleAverageQuery[](1);
        query[0] = IPriceOracle.OracleAverageQuery({
            variable: IPriceOracle.Variable.PAIR_PRICE,
            secs:     1 days,
            ago:      0
        });

        try pool.getTimeWeightedAverage(query) returns (uint256[] memory prices) {
          return sERC20IsToken0 ? (DECIMALS.mul(DECIMALS)).div(prices[0]) : prices[0] ;
        } catch Error(string memory reason) {
          if (keccak256(bytes(reason)) == keccak256(bytes("BAL#313"))) {
            return initialPrice;
          } else {
            revert(reason);
          }
        } catch {
            revert("sMinter: pool's oracle reverted");
        }
    }

    /**
     * @dev This function return sERC20's balance as first balance in the array.
     */ 
    function _balances(bytes32 poolId, bool sERC20IsToken0) private view returns (uint256[2] memory) {
        (, uint256[] memory balances, ) = _vault.getPoolTokens(poolId);

        if (sERC20IsToken0)
            return [balances[0], balances[1]];
        else
            return [balances[1], balances[0]];
    }

    function _allocation(uint256 allocation, uint256 amount) private pure returns (uint256) {
        return (allocation.mul(amount)).div(HUNDRED.sub(allocation));
    }

    function _doReward(address sERC20, sBootstrappingPool pool, bytes32 poolId, uint256 value, uint256 initialPrice, bool sERC20IsToken0) private returns (uint256) {
        uint256           reward;
        uint256[2] memory balances = _balances(poolId, sERC20IsToken0);

        if (balances[1] == 0) {
          uint256[] memory weights = pool.getNormalizedWeights();
          if (sERC20IsToken0) 
            reward = value * initialPrice * weights[0] / (DECIMALS * weights[1]);
          else
            reward = value * initialPrice * weights[1] / (DECIMALS * weights[0]);
        } else {
            reward = (value * balances[0]) / balances[1];
        }

        sIERC20(sERC20).mint(address(this), reward);
        sIERC20(sERC20).approve(address(_vault), reward);
        _vault.joinPool{value: value}(poolId, address(this), _bank, _request(sERC20, pool, reward, value, sERC20IsToken0));

        return reward;
    }
}
