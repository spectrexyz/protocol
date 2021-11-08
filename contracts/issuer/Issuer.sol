// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity 0.8.9;

import "./IIssuer.sol";
import "./interfaces/IBalancer.sol";
import "./interfaces/IFractionalizationBootstrappingPool.sol";
import "./interfaces/IFractionalizationBootstrappingPoolFactory.sol";
import "./libraries/Issuances.sol";
import "../token/sIERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title Issuer
 * @notice Handles the issuance of sERC20 tokens.
 */
contract Issuer is Context, AccessControlEnumerable, IIssuer {
    using Address for address payable;
    using Proposals for Proposals.Proposal;

    bytes32 public constant CLOSE_ROLE = keccak256("CLOSE_ROLE");
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    uint256 public constant DECIMALS = 1e18;
    uint256 public constant HUNDRED = 1e20;

    IBVault private immutable _vault;
    IFractionalizationBootstrappingPoolFactory private immutable _poolFactory;
    address private immutable _splitter;
    address private immutable _WETH;
    address private _bank;
    uint256 private _protocolFee;
    mapping(sIERC20 => Issuances.Issuance) private _issuances;

    constructor(
        IBVault vault_,
        IFractionalizationBootstrappingPoolFactory poolFactory_,
        address splitter_,
        address bank_,
        uint256 protocolFee_
    ) {
        require(address(vault_) != address(0), "Issuer: vault cannot be the zero address");
        require(address(poolFactory_) != address(0), "Issuer: pool factory cannot be the zero address");
        require(splitter_ != address(0), "Issuer: splitter cannot be the zero address");
        require(bank_ != address(0), "Issuer: bank cannot be the zero address");
        require(protocolFee_ < HUNDRED, "Issuer: protocol fee must be inferior to 100%");

        _vault = vault_;
        _poolFactory = poolFactory_;
        _splitter = splitter_;
        _WETH = vault_.WETH();
        _setBank(bank_);
        _setProtocolFee(protocolFee_);
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @notice Initiate the issuance of `sERC20`.
     * @dev - We do not check neither that:
     *        - `sERC20` is unregistered
     *        - nor that it actually is an sERC20
     *        - nor that this contract is granted MINT_ROLE over `sERC20`
     *        - nor that `allocation` is inferior to 100%
              to save gas.
     *      - Indeed, only trusted templates, registering sERC20s out of actual NFT fractionalizations and self-computing `allocation`, are supposed to be
     *        granted REGISTER_ROLE.
     *      - Pool-related parameters are checked by the FractionalizationBootstrappingPool's constructor.
     *      - Other parameters are checked because they are passed by users and forwarded unchecked by templates.
     * @param sERC20 The sERC20 to initiate the issuance of.
     * @param guardian The account authorized to enable flash issuance and accept / reject proposals otherwise [also receives ETH proceeds].
     * @param sMaxNormalizedWeight The maximum normalized weight of the sERC20 in the FractionalizationBootstrappingPool to be deployed.
     * @param sMinNormalizedWeight The minimum normalized weight of the sERC20 in the FractionalizationBootstrappingPool to be deployed.
     * @param swapFeePercentage The swap fee of the FractionalizationBootstrappingPool to be deployed [expressed with 1e16 decimals].
     * @param reserve The reserve price below which sERC20 tokens can be issued [expressed in sERC20 per ETH and 1e18 decimals].
     * @param allocation The pre-allocated percentage of sERC20s [expressed with 1e18 decimals].
     * @param fee The issuance fee.
     * @param flash True if flash issuance is enabled, false otherwise.
     */
    function register(
        sIERC20 sERC20,
        address guardian,
        uint256 sMaxNormalizedWeight,
        uint256 sMinNormalizedWeight,
        uint256 swapFeePercentage,
        uint256 reserve,
        uint256 allocation,
        uint256 fee,
        bool flash
    ) external override {
        IFractionalizationBootstrappingPool pool;
        Issuances.Issuance storage issuance = _issuances[sERC20];
        bool sERC20IsToken0 = address(sERC20) <= _WETH;

        require(hasRole(REGISTER_ROLE, _msgSender()), "Issuer: must have REGISTER_ROLE to register");
        require(guardian != address(0), "Issuer: guardian cannot be the zero address");
        require(reserve != 0, "Issuer: reserve price cannot be null");
        require(allocation < HUNDRED, "Issuer: allocation must be inferior to 100%");
        require(fee < HUNDRED, "Issuer: issuance fee must be inferior to 100%");

        if (sERC20IsToken0) {
            pool = IFractionalizationBootstrappingPool(
                _poolFactory.create(
                    "Fractionalization Bootstrapping Pool Token",
                    "FBPT",
                    address(sERC20),
                    _WETH,
                    sMaxNormalizedWeight,
                    sMinNormalizedWeight,
                    swapFeePercentage,
                    true
                )
            );
        } else {
            pool = IFractionalizationBootstrappingPool(
                _poolFactory.create(
                    "Fractionalization Bootstrapping Pool Token",
                    "FBPT",
                    _WETH,
                    address(sERC20),
                    sMaxNormalizedWeight,
                    sMinNormalizedWeight,
                    swapFeePercentage,
                    false
                )
            );
        }

        bytes32 poolId = pool.getPoolId();
        issuance.state = Issuances.State.Opened;
        issuance.guardian = guardian;
        issuance.pool = pool;
        issuance.poolId = poolId;
        issuance.reserve = reserve;
        issuance.allocation = allocation;
        issuance.fee = fee;
        issuance.sERC20IsToken0 = sERC20IsToken0;

        emit Register(sERC20, guardian, pool, poolId, sMaxNormalizedWeight, sMinNormalizedWeight, swapFeePercentage, reserve, allocation, fee);

        if (flash) _enableFlashIssuance(sERC20, issuance);
    }

    /**
     * @notice Issue at least `expected` `sERC20` tokens.
     * @dev - We do not check that sERC20.cap() > sERC20.totalSupply().
     *      - Indeed, to make sure the transaction does not revert, we would need to take both the price, LP reward and allocation into consideration.
     *      - That would involve a lot of un-necessary computations as the sERC20 reverts in such a situation anyhow.
     * @param expected The minimum amount of sERC20 to issue [reverts otherwise].
     */
    function issue(sIERC20 sERC20, uint256 expected) external payable override {
        Issuances.Issuance storage issuance = _issuances[sERC20];

        require(issuance.state == Issuances.State.Opened, "Issuer: invalid issuance state");
        require(issuance.flash, "Issuer: flash issuance is disabled");
        require(msg.value != 0, "Issuer: issuance value cannot be null");

        bool poolIsInitialized = issuance.pool.totalSupply() > 0;
        bool sERC20IsToken0 = issuance.sERC20IsToken0;

        uint256 price = _priceOf(issuance.pool, issuance.reserve, poolIsInitialized, sERC20IsToken0);
        uint256 amount = _issue(sERC20, issuance, _msgSender(), msg.value, price, poolIsInitialized, sERC20IsToken0);

        require(amount >= expected, "Issuer: insufficient issuance return");
    }

    /**
     * @notice Create a proposal to issue `sERC20` tokens at a price of `price` sERC20 per ETH.
     * @dev - We do not check that sERC20.cap() > sERC20.totalSupply().
     *      - Indeed, to make sure the transaction does not revert, we would need to take both the price, LP reward and allocation into consideration.
     *      - That would involve a lot of un-necessary computations as the sERC20 reverts in such a situation anyhow.
     * @param sERC20 The sERC20 to issue.
     * @param price The price at which sERC20s are proposed to be issued [in sERC20 per ETH].
     * @param lifespan The lifespan of the proposal [in seconds].
     */
    function createProposal(
        sIERC20 sERC20,
        uint256 price,
        uint256 lifespan
    ) external payable override returns (uint256) {
        Issuances.Issuance storage issuance = _issuances[sERC20];
        address buyer = _msgSender();

        require(issuance.state == Issuances.State.Opened, "Issuer: invalid issuance state");
        require(!issuance.flash, "Issuer: flash issuance is enabled");
        require(msg.value > 0, "Issuer: issuance value cannot be null");
        require(
            price > 0 && price <= _priceOf(issuance.pool, issuance.reserve, issuance.pool.totalSupply() > 0, issuance.sERC20IsToken0),
            "Issuer: invalid issuance price"
        );

        uint256 proposalId = issuance.nbOfProposals++;
        uint256 expiration = lifespan == 0 ? 0 : block.timestamp + lifespan;
        issuance.proposals[proposalId] = Proposals.Proposal({
            _state: Proposals.State.Pending,
            buyer: buyer,
            value: msg.value,
            price: price,
            expiration: expiration
        });

        emit CreateProposal(sERC20, proposalId, buyer, msg.value, price, expiration);

        return proposalId;
    }

    /**
     * @notice Accept proposal #`proposalId` to issue `sERC20` tokens.
     * @param sERC20 The sERC20 which was proposed to be issued.
     * @param proposalId The id of the issuance proposal.
     */
    function acceptProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Issuances.Issuance storage issuance = _issuances[sERC20];
        Proposals.Proposal storage proposal = issuance.proposals[proposalId];

        require(_msgSender() == issuance.guardian, "Issuer: must be issuance's guardian to accept proposal");
        require(issuance.state == Issuances.State.Opened, "Issuer: invalid issuance state");
        require(proposal.state() == Proposals.State.Pending, "Issuer: invalid proposal state");
        require(!issuance.flash, "Issuer: flash issuance is enabled");

        proposal._state = Proposals.State.Accepted;

        emit AcceptProposal(sERC20, proposalId);

        _issue(sERC20, issuance, proposal.buyer, proposal.value, proposal.price, issuance.pool.totalSupply() > 0, issuance.sERC20IsToken0);
    }

    /**
     * @notice Reject proposal #`proposalId` to issue `sERC20` tokens.
     * @dev This function is open to re-entrancy for it would be harmless.
     * @param sERC20 The sERC20 which was proposed to be issued.
     * @param proposalId The id of the issuance proposal.
     */
    function rejectProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Issuances.Issuance storage issuance = _issuances[sERC20];
        Proposals.Proposal storage proposal = issuance.proposals[proposalId];
        Proposals.State state = proposal.state();

        require(_msgSender() == issuance.guardian, "Issuer: must be issuance's guardian to reject proposal");
        require(state == Proposals.State.Pending || state == Proposals.State.Lapsed, "Issuer: invalid proposal state");

        proposal._state = Proposals.State.Rejected;
        payable(proposal.buyer).sendValue(proposal.value);

        emit RejectProposal(sERC20, proposalId);
    }

    /**
     * @notice Withdraw proposal #`proposalId` to issue `sERC20` tokens..
     * @dev This function is open to re-entrancy for it would be harmless.
     * @param sERC20 The sERC20 which was proposed to be issued.
     * @param proposalId The id of the issuance proposal.
     */
    function withdrawProposal(sIERC20 sERC20, uint256 proposalId) external override {
        Proposals.Proposal storage proposal = _issuances[sERC20].proposals[proposalId];
        Proposals.State state = proposal.state();

        require(_msgSender() == proposal.buyer, "Issuer: must be proposal's buyer to withdraw proposal");
        require(state == Proposals.State.Pending || state == Proposals.State.Lapsed, "Issuer: invalid proposal state");

        proposal._state = Proposals.State.Withdrawn;
        payable(proposal.buyer).sendValue(proposal.value);

        emit WithdrawProposal(sERC20, proposalId);
    }

    /**
     * @notice Close the issuance of `sERC20`.
     * @param sERC20 The sERC20 whose issuance to close.
     */
    function close(sIERC20 sERC20) external override {
        Issuances.Issuance storage issuance = _issuances[sERC20];

        require(hasRole(CLOSE_ROLE, _msgSender()), "Issuer: must have CLOSE_ROLE to close issuance");
        require(issuance.state == Issuances.State.Opened, "Issuer: invalid issuance state");

        issuance.state = Issuances.State.Closed;

        emit Close(sERC20);
    }

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

    /**
     * @notice Set the issuer's bank [to which protocol fees are transferred].
     */
    function setBank(address bank_) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Issuer: must have DEFAULT_ADMIN_ROLE to set bank");
        require(bank_ != address(0), "Issuer: bank cannot be the zero address");

        _setBank(bank_);
    }

    /**
     * @notice Set the issuer's protocol fee [expressed with 1e18 decimals].
     */
    function setProtocolFee(uint256 protocolFee_) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Issuer: must have DEFAULT_ADMIN_ROLE to set protocol fee");
        require(protocolFee_ < HUNDRED, "Issuer: protocol fee must be inferior to 100%");

        _setProtocolFee(protocolFee_);
    }

    /**
     * @notice Return the issuer's Balancer vault.
     */
    function vault() public view override returns (IBVault) {
        return _vault;
    }

    /**
     * @notice Return the issuer's pool factory.
     */
    function poolFactory() public view override returns (IFractionalizationBootstrappingPoolFactory) {
        return _poolFactory;
    }

    /**
     * @notice Return the issuer's splitter.
     */
    function splitter() public view override returns (address) {
        return _splitter;
    }

    /**
     * @notice Return the issuer's WETH.
     */
    function WETH() public view override returns (address) {
        return _WETH;
    }

    /**
     * @notice Return the issuer's bank.
     */
    function bank() public view override returns (address) {
        return _bank;
    }

    /**
     * @notice Return the issuer's protocol fee.
     */
    function protocolFee() public view override returns (uint256) {
        return _protocolFee;
    }

    /**
     * @notice Return the issuance associated to `sERC20`.
     * @param sERC20 The sERC20 whose issuance is queried.
     */
    function issuanceOf(sIERC20 sERC20)
        public
        view
        override
        returns (
            Issuances.State state,
            address guardian,
            IFractionalizationBootstrappingPool pool,
            bytes32 poolId,
            uint256 reserve,
            uint256 allocation,
            uint256 fee,
            uint256 nbOfProposals,
            bool flash,
            bool sERC20IsToken0
        )
    {
        Issuances.Issuance storage issuance = _issuances[sERC20];

        state = issuance.state;
        guardian = issuance.guardian;
        pool = issuance.pool;
        poolId = issuance.poolId;
        reserve = issuance.reserve;
        allocation = issuance.allocation;
        fee = issuance.fee;
        nbOfProposals = issuance.nbOfProposals;
        flash = issuance.flash;
        sERC20IsToken0 = issuance.sERC20IsToken0;
    }

    /**
     * @notice Return the proposal #`proposalId` to issue `sERC20` tokens.
     */
    function proposalFor(sIERC20 sERC20, uint256 proposalId)
        public
        view
        override
        returns (
            Proposals.State state,
            address buyer,
            uint256 value,
            uint256 price,
            uint256 expiration
        )
    {
        Proposals.Proposal storage proposal = _issuances[sERC20].proposals[proposalId];

        state = proposal.state();
        buyer = proposal.buyer;
        value = proposal.value;
        price = proposal.price;
        expiration = proposal.expiration;
    }

    /**
     * @notice Return the current issuance price of `sERC20` [in sERC20 per ETH].
     * @param sERC20 The sERC20 whose current issuance price is to be returned.
     */
    function priceOf(sIERC20 sERC20) public view override returns (uint256) {
        Issuances.Issuance storage issuance = _issuances[sERC20];

        require(issuance.state != Issuances.State.Null, "Issuer: invalid issuance state");

        return _priceOf(issuance.pool, issuance.reserve, issuance.pool.totalSupply() > 0, issuance.sERC20IsToken0);
    }

    /**
     * @notice Return the 24h time-weighted average price of `sERC20`.
     * @param sERC20 The sERC20 whose TWAP is to be returned.
     * @param kind TwapKind.ETH to return the TWAP in ETH per sERC20, TwapKind.sERC20 to return the TWAP in sERC20 per ETH.
     */
    function twapOf(sIERC20 sERC20, TwapKind kind) public view override returns (uint256) {
        Issuances.Issuance storage issuance = _issuances[sERC20];

        require(issuance.state != Issuances.State.Null, "Issuer: invalid issuance state");

        return _twapOf(issuance.pool, issuance.reserve, kind, issuance.pool.totalSupply() > 0, issuance.sERC20IsToken0);
    }

    function _issue(
        sIERC20 sERC20,
        Issuances.Issuance storage issuance,
        address buyer,
        uint256 value,
        uint256 price,
        bool poolIsInitialized,
        bool sERC20IsToken0
    ) private returns (uint256) {
        uint256 fee = (value * issuance.fee) / HUNDRED;
        uint256 protocolFee_ = ((value - fee) * _protocolFee) / HUNDRED;
        uint256 remaining = value - fee - protocolFee_;
        uint256 amount = (remaining * price) / DECIMALS;

        // pool LP reward
        uint256 reward = _doReward(sERC20, issuance, fee, price, poolIsInitialized, sERC20IsToken0);
        // mint recipient tokens
        sERC20.mint(buyer, amount);
        // mint allocation tokens
        uint256 allocation = _allocation(issuance.allocation, amount + reward);
        if (allocation > 0) sERC20.mint(_splitter, allocation);
        // poke weights
        issuance.pool.poke();
        // collect protocol fee
        if (protocolFee_ > 0) payable(_bank).sendValue(protocolFee_);
        // pay guardian
        payable(issuance.guardian).sendValue(remaining);

        emit Issue(sERC20, buyer, value, amount);

        return amount;
    }

    function _enableFlashIssuance(sIERC20 sERC20, Issuances.Issuance storage issuance) private {
        issuance.flash = true;

        emit EnableFlashIssuance(sERC20);
    }

    function _setBank(address bank_) private {
        _bank = bank_;

        emit SetBank(bank_);
    }

    function _setProtocolFee(uint256 protocolFee_) private {
        _protocolFee = protocolFee_;

        emit SetProtocolFee(protocolFee_);
    }

    function _doReward(
        sIERC20 sERC20,
        Issuances.Issuance storage issuance,
        uint256 value,
        uint256 price,
        bool poolIsInitialized,
        bool sERC20IsToken0
    ) private returns (uint256) {
        IBVault vault_ = _vault;
        uint256 reward = _reward(vault_, issuance.pool, issuance.poolId, price, value, poolIsInitialized, sERC20IsToken0);

        if (value > 0 || reward > 0) {
            sERC20.mint(address(this), reward);
            sERC20.approve(address(vault_), reward);
            vault_.joinPool{value: value}(issuance.poolId, address(this), _bank, _request(sERC20, reward, value, poolIsInitialized, sERC20IsToken0));
        }

        return reward;
    }

    function _reward(
        IBVault vault_,
        IFractionalizationBootstrappingPool pool,
        bytes32 poolId,
        uint256 price,
        uint256 value,
        bool poolIsInitialized,
        bool sERC20IsToken0
    ) private view returns (uint256) {
        uint256 reward;

        if (!poolIsInitialized) {
            uint256[] memory weights = pool.getNormalizedWeights();
            if (sERC20IsToken0) reward = (value * price * weights[0]) / (DECIMALS * weights[1]);
            else reward = (value * price * weights[1]) / (DECIMALS * weights[0]);
        } else {
            uint256[2] memory balances = _balances(vault_, poolId, sERC20IsToken0);
            reward = (value * balances[0]) / balances[1];
        }

        return reward;
    }

    /**
     * @notice Return the current sERC20 price [in sERC20 per ETH].
     * @dev - All prices are expressed in sERC20 per ETH.
     *      - Thus, if `reserve` is lower than `twap`, it means the reserve price in ETH per sERC20 is higher than the TWAP in ETH per sERC20.
     */
    function _priceOf(
        IFractionalizationBootstrappingPool pool,
        uint256 reserve,
        bool poolIsInitialized,
        bool sERC20IsToken0
    ) private view returns (uint256) {
        uint256 twap = _twapOf(pool, reserve, TwapKind.sERC20, poolIsInitialized, sERC20IsToken0);

        if (reserve < twap) return reserve;
        else return twap;
    }

    /**
     * @notice Return the 24h time-weighted average price of `issuance`'s sERC20.
     * @dev - We do not care about decimals for both ETH and sERC20s have 18 decimals.
     *      - See PriceOracle.sol for details.
     */
    function _twapOf(
        IFractionalizationBootstrappingPool pool,
        uint256 reserve,
        TwapKind kind,
        bool poolIsInitialized,
        bool sERC20IsToken0
    ) private view returns (uint256) {
        if (!poolIsInitialized) {
            if (kind == TwapKind.ETH) return (DECIMALS * DECIMALS) / reserve;
            else if (kind == TwapKind.sERC20) return reserve;
            else revert("Issuer: invalid twap kind");
        }

        IPriceOracle.OracleAverageQuery[] memory query = new IPriceOracle.OracleAverageQuery[](1);
        query[0] = IPriceOracle.OracleAverageQuery({variable: IPriceOracle.Variable.PAIR_PRICE, secs: 1 days, ago: 0});
        uint256[] memory prices = pool.getTimeWeightedAverage(query);

        if (kind == TwapKind.ETH) {
            return !sERC20IsToken0 ? prices[0] : (DECIMALS * DECIMALS) / prices[0];
        } else if (kind == TwapKind.sERC20) {
            return sERC20IsToken0 ? prices[0] : (DECIMALS * DECIMALS) / prices[0];
        } else {
            revert("Issuer: invalid twap kind");
        }
    }

    /**
     * @dev Return [sERC20, WETH] pool's balances.
     */
    function _balances(
        IBVault vault_,
        bytes32 poolId,
        bool sERC20IsToken0
    ) private view returns (uint256[2] memory) {
        (, uint256[] memory balances, ) = vault_.getPoolTokens(poolId);

        if (sERC20IsToken0) return [balances[0], balances[1]];
        else return [balances[1], balances[0]];
    }

    /**
     * @notice Return the amount of tokens to additionally issue to preserve the `allocation` ratio when `amount` sERC20s are issued.
     */
    function _allocation(uint256 allocation, uint256 amount) private pure returns (uint256) {
        return (allocation * amount) / (HUNDRED - allocation);
    }

    function _request(
        sIERC20 sERC20,
        uint256 amount,
        uint256 value,
        bool poolIsInitialized,
        bool sERC20IsToken0
    ) private pure returns (IBVault.JoinPoolRequest memory) {
        IFractionalizationBootstrappingPool.JoinKind kind = poolIsInitialized
            ? IFractionalizationBootstrappingPool.JoinKind.REWARD
            : IFractionalizationBootstrappingPool.JoinKind.INIT;

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

        return IBVault.JoinPoolRequest({assets: assets, maxAmountsIn: amounts, userData: abi.encode(kind, amounts), fromInternalBalance: false});
    }
}
