// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interfaces/IBalancer.sol";
import "./interfaces/IFractionalizationBootstrappingPool.sol";
import "./interfaces/IFractionalizationBootstrappingPoolFactory.sol";
import "./libraries/Issuances.sol";
import "../token/sIERC20.sol";

interface IIssuer {
    enum TwapKind { ETH, sERC20 }

    /**
     * @notice Emitted when an `sERC20`pit is registered.
     */
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
    event CreateProposal(sIERC20 indexed sERC20, uint256 indexed proposalId, address indexed buyer, uint256 value, uint256 amount, uint256 expiration);
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

    // /**
    //  * @notice Mints sERC20s against sent ETH.
    //  * @param  sERC20    The sERC20 to mint.
    //  * @param  expected  The amount of sERC20 tokens expected in return for the ETH sent [reverts otherwise].
    //  * @param  recipient The recipient of the sERC20 tokens to mint.
    //  */
    function issue(sIERC20 sERC20, uint256 expected) external payable;

    function createProposal(
        sIERC20 sERC20,
        uint256 amount,
        uint256 lifespan
    ) external payable returns (uint256);

    function close(sIERC20 sERC20) external;

    function enableFlashIssuance(sIERC20 sERC20) external;

    /**
     * @notice Transfers any ERC20 or ETH owned by this contract to the bank.
     * @param  token The address of the ERC20 token to withdraw [address(0) for ETH].
     */
    function withdraw(address token) external;

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

    function twapOf(sIERC20 sERC20, TwapKind Kind) external view returns (uint256);
}
