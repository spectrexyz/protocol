// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./IIssuer.sol";
import "./interfaces/IBalancer.sol";
import "./interfaces/ISpectralizationBootstrappingPool.sol";
import "./libraries/Issuances.sol";
import "../token/sIERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "hardhat/console.sol";

contract Issuer is Context, AccessControlEnumerable, IIssuer {
    using Address for address payable;

    bytes32 public constant CLOSE_ROLE = keccak256("REGISTER_ROLE");
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    uint256 public constant DECIMALS = 1e18;
    uint256 public constant HUNDRED = 1e20;

    modifier protected() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Issuer: protected operation");
        _;
    }

    IBVault private immutable _vault;
    address private _bank;
    address private _splitter;
    uint256 private _protocolFee;
    mapping(sIERC20 => Issuances.Issuance) private _issuances;

    constructor(
        IBVault vault_,
        address bank_,
        address splitter_,
        uint256 protocolFee_
    ) {
        require(address(vault_) != address(0), "Issuer: vault cannot be the zero address");
        require(bank_ != address(0), "Issuer: bank cannot be the zero address");
        require(splitter_ != address(0), "Issuer: splitter cannot be the zero address");
        require(protocolFee_ < HUNDRED, "Issuer: protocol fee must be inferior to 100%");

        _vault = vault_;
        _bank = bank_;
        _splitter = splitter_;
        _protocolFee = protocolFee_;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @notice Initiate the issuance of `sERC20`.
     * @dev - We do not check neither that:
     *        - `sERC20` is unregistered
     *        - nor that it actually is an sERC20
     *        - nor that this contract is granted MINT_ROLE over `sERC20`
     *        - nor that `pool` actually is a Balancer pool
     *        - nor that `allocation` is inferior to 100%
              to save gas.
     *      - Indeed, only trusted templates, registering sERC20s out of actual NFT fractionalizations and self-computing `allocation`, are supposed to be
     *        granted REGISTER_ROLE.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by templates.
     * @param sERC20 The sERC20 to initiate the issuance of.
     * @param pool The address of the sERC20's Balancer pool.
     * @param guardian The account authorized to enable flash issuance and accept / reject proposals otherwise [also receives ETH proceeds].
     * @param reserve The reserve price below which sERC20 tokens can be issued [expressed in sERC20 per ETH and 1e18 decimals].
     * @param allocation The pre-allocated percentage of sERC20s [expressed with 1e18 decimals].
     * @param fee The minting fee.
     * @param flash True if flash issuance is enabled, false otherwise.
     */
    function register(
        sIERC20 sERC20,
        address guardian,
        ISpectralizationBootstrappingPool pool,
        uint256 reserve,
        uint256 allocation,
        uint256 fee,
        bool flash
    ) external override {
        Issuances.Issuance storage issuance = _issuances[sERC20];

        require(hasRole(REGISTER_ROLE, _msgSender()), "Issuer: must have REGISTER_ROLE to register");
        require(guardian != address(0), "Issuer: guardian cannot be the zero address");
        require(reserve != 0, "Issuer: reserve price cannot be null");
        require(fee < HUNDRED, "Issuer: minting fee must be inferior to 100%");

        issuance.state = Issuances.State.Opened;
        issuance.pool = pool;
        issuance.poolId = pool.getPoolId();
        issuance.poolIsRegular = pool.sERC20IsToken0();
        issuance.guardian = guardian;
        issuance.reserve = reserve;
        issuance.allocation = allocation;
        issuance.fee = fee;

        if (flash) _enableFlashIssuance(sERC20, issuance);

        emit Register(sERC20, guardian, pool, reserve, allocation, fee);
    }

    /**
     *
     */
    function mint(sIERC20 sERC20, uint256 expected) external payable override {
        Issuances.Issuance storage issuance = _issuances[sERC20];

        require(issuance.state == Issuances.State.Opened, "Issuer: invalid issuance state");
        require(msg.value != 0, "Issuer: minted value cannot be null");

        uint256 price = _priceOf(issuance);
        uint256 amount = (price * msg.value) / DECIMALS;

        // vérifier le reserve price !!

        // il faut une fonction _priceOf qui renvoie le max de twapOf et reservePrice
        require(amount >= expected, "Issuer: insufficient minting return");

        _mint(sERC20, issuance, _msgSender(), msg.value, amount);
    }

    /**
     * @notice Create a proposal to mint `amount` tokens of `sERC20`.
     * @param sERC20 The sERC20 to mint.
     * @param amount The amount of tokens to mint.
     * @param lifespan The lifespan of the proposal [in seconds].
     */
    function createProposal(
        sIERC20 sERC20,
        uint256 amount,
        uint256 lifespan
    ) external payable override returns (uint256) {
        Issuances.Issuance storage issuance = _issuances[sERC20];
        address buyer = _msgSender();

        require(issuance.state == Issuances.State.Opened, "Issuer: invalid issuance state");
        require(!issuance.flash, "Issuer: flash minting is enabled");

        uint256 price = _twapOf(issuance);
        require(amount <= price * msg.value, "Broker: insufficient value");

        uint256 proposalId = issuance.nbOfProposals++;
        uint256 expiration = lifespan == 0 ? 0 : block.timestamp + lifespan;
        issuance.proposals[proposalId] = Proposals.Proposal({
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

    /**
     * @notice Enable flash issuance for `sERC20`.
     * @param sERC20 The sERC20 to enable flash issuance for.
     */
    function enableFlashIssuance(sIERC20 sERC20) external override {
        Issuances.Issuance storage issuance = _issuances[sERC20];

        require(_msgSender() == issuance.guardian, "Issuer: must be issuance's guardian to enable flash issuance");
        require(issuance.state == Issuances.State.Opened, "Issuer: invalid issuance state");
        require(!issuance.flash, "Issuer: flash issuance already enabled");

        _enableFlashIssuance(sERC20, issuance);
    }

    // Peut être pas necessaire : SI, pour withdraw les sous des LPs quand c'est le issuance est Closed
    function withdraw(address token) external override {
        // if (token == address(0)) {
        //     _bank.sendValue(address(this).balance);
        // } else {
        //     sIERC20(token).transfer(_bank, sIERC20(token).balanceOf(address(this)));
        // }
    }

    /* #region setters */
    function setBank(address payable bank_) external override protected {
        require(bank_ != address(0), "Issuer: bank cannot be the zero address");

        _bank = bank_;
    }

    function setSplitter(address splitter_) external override protected {
        require(splitter_ != address(0), "Issuer: splitter cannot be the zero address");

        _splitter = splitter_;
    }

    function setProtocolFee(uint256 protocolFee_) external override protected {
        require(protocolFee_ < HUNDRED, "Issuer: protocol fee must be inferior to 100%");

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
        return _twapOf(_issuances[sERC20]);
    }

    function issuanceOf(sIERC20 sERC20)
        public
        view
        override
        returns (
            Issuances.State state,
            ISpectralizationBootstrappingPool pool,
            address guardian,
            uint256 reserve,
            uint256 allocation,
            uint256 fee,
            uint256 nbOfProposals,
            bool flash
        )
    {
        Issuances.Issuance storage issuance = _issuances[sERC20];
        
        state = issuance.state;
        pool = issuance.pool;
        guardian = issuance.guardian;
        reserve = issuance.reserve;
        allocation = issuance.allocation;
        fee = issuance.fee;
        nbOfProposals = issuance.nbOfProposals;
        flash = issuance.flash;
    }

    /* #endregion*/

    /* #region private */

    function _mint(
        sIERC20 sERC20,
        Issuances.Issuance storage issuance,
        address buyer,
        uint256 value,
        uint256 amount
    ) private {
        uint256 fee = (value * issuance.fee) / HUNDRED;
        uint256 protocolFee_ = ((value - fee) * _protocolFee) / HUNDRED;
        uint256 remaining = value - fee - protocolFee_; //msg.value.sub(protocolFee).sub(fee);
        // // pool LP reward
        uint256 reward = _rewardAndLock(sERC20, issuance, fee);
        // mint recipient tokens
        sERC20.mint(buyer, amount);
        // mint allocation tokens
        sERC20.mint(_splitter, _allocation(issuance.allocation, amount + reward));
        // // poke weights
        // pool.pokeWeights();
        // collect protocol fee
        payable(_bank).sendValue(protocolFee_);
        // // pay beneficiary
        payable(issuance.guardian).sendValue(remaining);
        emit Mint(sERC20, buyer, msg.value, amount);
    }

    function _enableFlashIssuance(sIERC20 sERC20, Issuances.Issuance storage issuance) private {
        issuance.flash = true;

        emit EnableFlashIssuance(sERC20);
    }

    function _request(
        sIERC20 sERC20,
        ISpectralizationBootstrappingPool pool,
        uint256 amount,
        uint256 value,
        bool poolIsRegular
    ) private view returns (IBVault.JoinPoolRequest memory) {
        IAsset[] memory assets = new IAsset[](2);
        uint256[] memory amounts = new uint256[](2);

        if (poolIsRegular) {
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
     * @dev This function always returns the price in sERC20 per ETH.
     */
    function _priceOf(Issuances.Issuance storage issuance) private view returns (uint256) {
        uint256 twap = _twapOf(issuance);
        uint256 reserve = issuance.reserve;

        // prices are expressed in sERC20 per ETH
        // so if `reserve` is lower than `twap` it means that the reserve price in ETH per sERC20 is higher than the TWAP in ETH per sERC20
        if (reserve <= twap) return reserve;
        else return twap;
    }

    /**
     * @dev - This function always returns the price in sERC20 per ETH [see PriceOracle.sol for details].
     *      - This function do not care about decimals as both ETH and sERC20s have 18 decimals.
     */
    function _twapOf(Issuances.Issuance storage issuance) private view returns (uint256) {
        IPriceOracle.OracleAverageQuery[] memory query = new IPriceOracle.OracleAverageQuery[](1);
        query[0] = IPriceOracle.OracleAverageQuery({variable: IPriceOracle.Variable.PAIR_PRICE, secs: 1 days, ago: 0});

        try issuance.pool.getTimeWeightedAverage(query) returns (uint256[] memory prices) {
            // si le prix est inférieur à la reserve on envoie la reserve !
            return issuance.poolIsRegular ? prices[0] : (DECIMALS * DECIMALS) / prices[0];
        } catch Error(string memory reason) {
            if (keccak256(bytes(reason)) == keccak256(bytes("BAL#313"))) {
                return issuance.reserve;
            } else {
                revert(reason);
            }
        } catch {
            revert("Issuer: pool's oracle reverted");
        }
    }

    /**
     * @dev This function return sERC20's balance as first balance in the array.
     */
    function _balances(bytes32 poolId, bool poolIsRegular) private view returns (uint256[2] memory) {
        (, uint256[] memory balances, ) = _vault.getPoolTokens(poolId);

        if (poolIsRegular) return [balances[0], balances[1]];
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
        bool poolIsRegular
    ) private returns (uint256) {
        uint256 reward;
        uint256[2] memory balances = _balances(poolId, poolIsRegular);

        if (balances[1] == 0) {
            uint256[] memory weights = pool.getNormalizedWeights();
            if (poolIsRegular) reward = (value * initialPrice * weights[0]) / (DECIMALS * weights[1]);
            else reward = (value * initialPrice * weights[1]) / (DECIMALS * weights[0]);
        } else {
            reward = (value * balances[0]) / balances[1];
        }

        sIERC20(sERC20).mint(address(this), reward);
        sIERC20(sERC20).approve(address(_vault), reward);
        _vault.joinPool{value: value}(poolId, address(this), _bank, _request(sIERC20(sERC20), pool, reward, value, poolIsRegular));

        return reward;
    }

    function _rewardAndLock(
        sIERC20 sERC20,
        Issuances.Issuance storage issuance,
        uint256 value
    ) private returns (uint256) {
        uint256 reward;
        bytes32 poolId = issuance.poolId;
        bool isRegular = issuance.poolIsRegular;
        uint256[2] memory balances = _balances(poolId, isRegular);

        if (balances[1] == 0) {
            uint256[] memory weights = issuance.pool.getNormalizedWeights();
            if (isRegular) reward = (value * issuance.reserve * weights[0]) / (DECIMALS * weights[1]);
            else reward = (value * issuance.reserve * weights[1]) / (DECIMALS * weights[0]);
        } else {
            reward = (value * balances[0]) / balances[1];
        }

        sIERC20(sERC20).mint(address(this), reward);
        sIERC20(sERC20).approve(address(_vault), reward);
        _vault.joinPool{value: value}(poolId, address(this), _bank, _request(sERC20, issuance.pool, reward, value, isRegular));
        // pool some of it with this contract

        return reward;
    }
}
