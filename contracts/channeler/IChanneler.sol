// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../broker/IBroker.sol";
import {IIssuer} from "../issuer/IIssuer.sol";
import "../utils/ISplitter.sol";
import "../vault/IVault.sol";
import "../token/sIERC20.sol";
import "../token/sIERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IChanneler {
    struct FractionalizationData {
        address guardian;
        string name;
        string symbol;
        uint256 cap;
        uint256 buyoutReserve;
        uint256 multiplier;
        uint256 timelock;
        uint256 sMaxNormalizedWeight;
        uint256 sMinNormalizedWeight;
        address[] beneficiaries;
        uint256[] shares;
        uint256 swapFeePercentage;
        uint256 issuanceReserve;
        uint256 fee;
        bool buyoutFlash;
        bool issuanceFlash;
    }

    function mintAndFractionalize(string memory _tokenURI, FractionalizationData calldata data) external;

    function fractionalize(
        IERC721 collection,
        uint256 tokenId,
        FractionalizationData calldata data
    ) external;

    function pause() external;

    function unpause() external;

    function sERC721() external view returns (sIERC721);

    function vault() external view returns (IVault);

    function issuer() external view returns (IIssuer);

    function broker() external view returns (IBroker);

    function splitter() external view returns (ISplitter);
}
