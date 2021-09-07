// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./IIssuer.sol";
import "./interfaces/IBalancer.sol";
import "./interfaces/ISpectralizationBootstrappingPool.sol";
import "./libraries/Markets.sol";
import "../token/sIERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "hardhat/console.sol";

contract Issuer is Context, AccessControl, IIssuer {
    using Address for address payable;

    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    uint256 public constant DECIMALS = 1e18;
    uint256 public constant HUNDRED = 1e20;

    modifier protected() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "MarketHall: protected operation");
        _;
    }

    IBVault private immutable _vault;
    address payable private _bank;
    address private _splitter;
    uint256 private _protocolFee;
    mapping(sIERC20 => Markets.Market) private _markets;

    constructor(
        IBVault vault_,
        address payable bank_,
        address splitter_,
        uint256 protocolFee_
    ) {
        require(address(vault_) != address(0), "MarketHall: vault cannot be the zero address");
        require(bank_ != address(0), "MarketHall: bank cannot be the zero address");
        require(splitter_ != address(0), "MarketHall: splitter cannot be the zero address");
        require(protocolFee_ < HUNDRED, "MarketHall: protocol fee must be inferior to 100%");

        _vault = vault_;
        _bank = bank_;
        _splitter = splitter_;
        _protocolFee = protocolFee_;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     *
     */
    function mint(sIERC20 sERC20, uint256 expected) external payable override {
        Markets.Market storage market = _markets[sERC20];

        require(market.state == Markets.State.Opened, "MarketHall: invalid market state");
        require(msg.value != 0, "MarketHall: minted value cannot be null");

        uint256 price = _twapOf(market);
        uint256 amount = (price * msg.value) / DECIMALS;

        require(amount >= expected, "MarketHall: insufficient minting return");

        _mint(sERC20, market, _msgSender(), msg.value, amount);
    }

    function _mint(
        sIERC20 sERC20,
        Markets.Market storage market,
        address buyer,
        uint256 value,
        uint256 amount
    ) private {
        uint256 fee = (value * market.fee) / HUNDRED;
        uint256 protocolFee_ = ((value - fee) * _protocolFee) / HUNDRED;
        uint256 remaining = value - fee - protocolFee_; //msg.value.sub(protocolFee).sub(fee);
        // // pool LP reward
        uint256 reward = _rewardAndLock(sERC20, market, fee);
        // mint recipient tokens
        sERC20.mint(buyer, amount);
        // mint allocation tokens
        sERC20.mint(_splitter, _allocation(market.allocation, amount + reward));
        // // poke weights
        // pool.pokeWeights();
        // collect protocol fee
        _bank.sendValue(protocolFee_);
        // // pay beneficiary
        market.guardian.sendValue(remaining);
        emit Mint(sERC20, buyer, msg.value, amount);
    }

    function register(
        sIERC20 sERC20,
        address pool,
        address payable guardian,
        uint256 reserve,
        uint256 allocation,
        uint256 fee,
        bool flash
    ) external override {
        require(hasRole(REGISTER_ROLE, _msgSender()), "MarketHall: must have REGISTER_ROLE to register");
        require(guardian != payable(address(0)), "MarketHall: beneficiary cannot be the zero address");
        require(reserve != 0, "MarketHall: reserve price cannot be null");
        require(allocation < HUNDRED, "MarketHall: allocation must be inferior to 100%");
        require(fee < HUNDRED, "MarketHall: minting fee must be inferior to 100%");

        // we should deploy the pool here in the future ?
        _markets[sERC20].state = Markets.State.Opened;
        _markets[sERC20].pool = ISpectralizationBootstrappingPool(pool);
        _markets[sERC20].poolId = ISpectralizationBootstrappingPool(pool).getPoolId();
        _markets[sERC20].sERC20Index = ISpectralizationBootstrappingPool(pool).sERC20IsToken0() ? 0 : 1;
        _markets[sERC20].guardian = guardian;
        _markets[sERC20].reserve = reserve;
        _markets[sERC20].allocation = allocation;
        _markets[sERC20].fee = fee;
        _markets[sERC20].flash = flash;

        // emit Register(sERC20, pool, address(beneficiary), initialPrice, allocation, fee, protocolFee);
    }

    /**
     * @notice Create a proposal to mint `amount` token of `sERC20`.
     * @param sERC20 The sERC20 to mint.
     * @param amount The amount of tokens to mint.
     * @param lifespan The lifespan of the proposal [in seconds].
     */
    function createProposal(
        sIERC20 sERC20,
        uint256 amount,
        uint256 lifespan
    ) external payable override returns (uint256) {
        Markets.Market storage market = _markets[sERC20];
        address buyer = _msgSender();

        require(market.state == Markets.State.Opened, "MarketHall: invalid market state");
        require(!market.flash, "MarketHall: flash minting is enabled");

        uint256 price = _twapOf(market);
        require(amount <= price * msg.value, "Broker: insufficient value");

        uint256 proposalId = market.nbOfProposals++;
        uint256 expiration = lifespan == 0 ? 0 : block.timestamp + lifespan;
        market.proposals[proposalId] = Proposals.Proposal({
            _state: Proposals.State.Pending,
            buyer: buyer,
            value: msg.value,
            amount: amount,
            expiration: expiration
        });

        emit CreateProposal(sERC20, proposalId, buyer, msg.value, amount, expiration);

        return proposalId;
    }

    function close(sIERC20 sERC20) external override {}

    // Peut être pas necessaire : SI, pour withdraw les sous des LPs quand c'est le market est Closed
    function withdraw(address token) external override {
        // if (token == address(0)) {
        //     _bank.sendValue(address(this).balance);
        // } else {
        //     sIERC20(token).transfer(_bank, sIERC20(token).balanceOf(address(this)));
        // }
    }

    /* #region setters */
    function setBank(address payable bank_) external override protected {
        require(bank_ != address(0), "MarketHall: bank cannot be the zero address");

        _bank = bank_;
    }

    function setSplitter(address splitter_) external override protected {
        require(splitter_ != address(0), "MarketHall: splitter cannot be the zero address");

        _splitter = splitter_;
    }

    function setProtocolFee(uint256 protocolFee_) external override protected {
        require(protocolFee_ < HUNDRED, "MarketHall: protocol fee must be inferior to 100%");

        _protocolFee = protocolFee_;
    }

    /* #endregion*/

    /* #region getters */
    function vault() public view override returns (IBVault) {
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

    function twapOf(sIERC20 sERC20) public view override returns (uint256) {
        return _twapOf(_markets[sERC20]);
    }

    // function marketOf(address sERC20) public view override returns (Markets.Market memory) {
    //     return _markets[sERC20];
    // }

    /* #endregion*/

    /* #region private */
    function _request(
        sIERC20 sERC20,
        ISpectralizationBootstrappingPool pool,
        uint256 amount,
        uint256 value,
        bool sERC20IsToken0
    ) private view returns (IBVault.JoinPoolRequest memory) {
        IAsset[] memory assets = new IAsset[](2);
        uint256[] memory amounts = new uint256[](2);

        if (sERC20IsToken0) {
            assets[0] = IAsset(address(sERC20));
            assets[1] = IAsset(address(0));
            amounts[0] = amount;
            amounts[1] = value;
        } else {
            assets[0] = IAsset(address(0));
            assets[1] = IAsset(address(sERC20));
            amounts[0] = value;
            amounts[1] = amount;
        }

        return
            pool.totalSupply() > 0
                ? IBVault.JoinPoolRequest({
                    assets: assets,
                    maxAmountsIn: amounts,
                    userData: abi.encode(ISpectralizationBootstrappingPool.JoinKind.REWARD, amounts),
                    fromInternalBalance: false
                })
                : IBVault.JoinPoolRequest({
                    assets: assets,
                    maxAmountsIn: amounts,
                    userData: abi.encode(ISpectralizationBootstrappingPool.JoinKind.INIT, amounts),
                    fromInternalBalance: false
                });
    }

    /**
     * @dev - This function always returns the price in sERC20 per ETH [see PriceOracle.sol for details].
     *      - This function do not care about decimals as both ETH and sERC20s have 18 decimals.
     */
    function _twapOf(Markets.Market storage market) private view returns (uint256) {
        IPriceOracle.OracleAverageQuery[] memory query = new IPriceOracle.OracleAverageQuery[](1);
        query[0] = IPriceOracle.OracleAverageQuery({variable: IPriceOracle.Variable.PAIR_PRICE, secs: 1 days, ago: 0});

        try market.pool.getTimeWeightedAverage(query) returns (uint256[] memory prices) {
            // si le prix est inférieur à la reserve on envoie la reserve !
            return market.sERC20Index == 0 ? prices[0] : (DECIMALS * DECIMALS) / prices[0];
        } catch Error(string memory reason) {
            if (keccak256(bytes(reason)) == keccak256(bytes("BAL#313"))) {
                return market.reserve;
            } else {
                revert(reason);
            }
        } catch {
            revert("MarketHall: pool's oracle reverted");
        }
    }

    /**
     * @dev This function return sERC20's balance as first balance in the array.
     */
    function _balances(bytes32 poolId, bool sERC20IsToken0) private view returns (uint256[2] memory) {
        (, uint256[] memory balances, ) = _vault.getPoolTokens(poolId);

        if (sERC20IsToken0) return [balances[0], balances[1]];
        else return [balances[1], balances[0]];
    }

    function _allocation(uint256 allocation, uint256 amount) private pure returns (uint256) {
        return (allocation * amount) / (HUNDRED - allocation);
    }

    function _doReward(
        address sERC20,
        ISpectralizationBootstrappingPool pool,
        bytes32 poolId,
        uint256 value,
        uint256 initialPrice,
        bool sERC20IsToken0
    ) private returns (uint256) {
        uint256 reward;
        uint256[2] memory balances = _balances(poolId, sERC20IsToken0);

        if (balances[1] == 0) {
            uint256[] memory weights = pool.getNormalizedWeights();
            if (sERC20IsToken0) reward = (value * initialPrice * weights[0]) / (DECIMALS * weights[1]);
            else reward = (value * initialPrice * weights[1]) / (DECIMALS * weights[0]);
        } else {
            reward = (value * balances[0]) / balances[1];
        }

        sIERC20(sERC20).mint(address(this), reward);
        sIERC20(sERC20).approve(address(_vault), reward);
        _vault.joinPool{value: value}(poolId, address(this), _bank, _request(sIERC20(sERC20), pool, reward, value, sERC20IsToken0));

        return reward;
    }

    function _rewardAndLock(
        sIERC20 sERC20,
        Markets.Market storage market,
        uint256 value
    ) private returns (uint256) {
        uint256 reward;
        bytes32 poolId = market.poolId;
        bool isRegular = market.sERC20Index == 0;
        uint256[2] memory balances = _balances(poolId, isRegular);

        if (balances[1] == 0) {
            uint256[] memory weights = market.pool.getNormalizedWeights();
            if (isRegular) reward = (value * market.reserve * weights[0]) / (DECIMALS * weights[1]);
            else reward = (value * market.reserve * weights[1]) / (DECIMALS * weights[0]);
        } else {
            reward = (value * balances[0]) / balances[1];
        }

        sIERC20(sERC20).mint(address(this), reward);
        sIERC20(sERC20).approve(address(_vault), reward);
        _vault.joinPool{value: value}(poolId, address(this), _bank, _request(sERC20, market.pool, reward, value, isRegular));
        // pool some of it with this contract

        return reward;
    }
}
