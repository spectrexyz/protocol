// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interfaces/IBalancer.sol";
import "./interfaces/IFractionalizationBootstrappingPool.sol";
import "./interfaces/IFractionalizationBootstrappingPoolFactory.sol";
import "./libraries/Issuances.sol";
import "../token/sIERC20.sol";

interface IIssuer {
    enum TwapKind {
        ETH,
        sERC20
    }

    event Register(
        sIERC20 indexed sERC20,
        address indexed guardian,
        IFractionalizationBootstrappingPool pool,
        bytes32 poolId,
        uint256 sMaxNormalizedWeight,
        uint256 sMinNormalizedWeight,
        uint256 swapFeePercentage,
        uint256 reserve,
        uint256 allocation,
        uint256 fee
    );
    event Issue(sIERC20 indexed sERC20, address indexed recipient, uint256 value, uint256 amount);
    event CreateProposal(sIERC20 indexed sERC20, uint256 indexed proposalId, address indexed buyer, uint256 value, uint256 price, uint256 expiration);
    event AcceptProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event RejectProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event WithdrawProposal(sIERC20 indexed sERC20, uint256 indexed proposalId);
    event Close(sIERC20);
    event EnableFlashIssuance(sIERC20 indexed sERC20);
    event SetBank(address bank);
    event SetProtocolFee(uint256 protocolFee);

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
    ) external;

    function issue(sIERC20 sERC20, uint256 expected) external payable;

    function createProposal(
        sIERC20 sERC20,
        uint256 amount,
        uint256 lifespan
    ) external payable returns (uint256);

    function acceptProposal(sIERC20 sERC20, uint256 proposalId) external;

    function rejectProposal(sIERC20 sERC20, uint256 proposalId) external;

    function withdrawProposal(sIERC20 sERC20, uint256 proposalId) external;

    function close(sIERC20 sERC20) external;

    function enableFlashIssuance(sIERC20 sERC20) external;

    function setBank(address bank_) external;

    function setProtocolFee(uint256 protocolFee_) external;

    function vault() external view returns (IBVault);

    function poolFactory() external view returns (IFractionalizationBootstrappingPoolFactory);

    function splitter() external view returns (address);

    function WETH() external view returns (address);

    function bank() external view returns (address);

    function protocolFee() external view returns (uint256);

    function issuanceOf(sIERC20 sERC20)
        external
        view
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
        );

    function proposalFor(sIERC20 sERC20, uint256 proposalId)
        external
        view
        returns (
            Proposals.State state,
            address buyer,
            uint256 value,
            uint256 price,
            uint256 expiration
        );

    function priceOf(sIERC20 sERC20) external view returns (uint256);

    function twapOf(sIERC20 sERC20, TwapKind Kind) external view returns (uint256);
}
