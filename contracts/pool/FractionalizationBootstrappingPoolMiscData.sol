// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.0;

import "@balancer-labs/v2-solidity-utils/contracts/helpers/WordCodec.sol";

/**
 * @dev This module provides an interface to store seemingly unrelated pieces of information, in particular used by
 * pools with a price oracle.
 *
 * These pieces of information are all kept together in a single storage slot to reduce the number of storage reads. In
 * particular, we not only store configuration values (such as the swap fee percentage), but also cache
 * reduced-precision versions of the total BPT supply and invariant, which lets us not access nor compute these values
 * when producing oracle updates during a swap.
 *
 * Data is stored with the following structure:
 *
 * [ swap fee pct | oracle index | oracle sample initial timestamp | log supply | log invariant ]
 * [    uint64    |    uint10    |              uint31             |    int22   |     int22     ]
 *
 * Note that we are not using the most-significant 106 bits.
 */
library FractionalizationBootstrappingPoolMiscData {
    using WordCodec for bytes32;
    using WordCodec for uint256;

    uint256 private constant _LOG_INVARIANT_OFFSET = 0;
    uint256 private constant _LOG_TOTAL_SUPPLY_OFFSET = 22;
    uint256 private constant _ORACLE_SAMPLE_CREATION_TIMESTAMP_OFFSET = 44;
    uint256 private constant _ORACLE_INDEX_OFFSET = 75;
    uint256 private constant _SWAP_FEE_PERCENTAGE_OFFSET = 85;

    /**
     * @dev Returns the cached logarithm of the invariant.
     */
    function logInvariant(bytes32 data) internal pure returns (int256) {
        return data.decodeInt22(_LOG_INVARIANT_OFFSET);
    }

    /**
     * @dev Returns the cached logarithm of the total supply.
     */
    function logTotalSupply(bytes32 data) internal pure returns (int256) {
        return data.decodeInt22(_LOG_TOTAL_SUPPLY_OFFSET);
    }

    /**
     * @dev Returns the timestamp of the creation of the oracle's latest sample.
     */
    function oracleSampleCreationTimestamp(bytes32 data) internal pure returns (uint256) {
        return data.decodeUint31(_ORACLE_SAMPLE_CREATION_TIMESTAMP_OFFSET);
    }

    /**
     * @dev Returns the index of the oracle's latest sample.
     */
    function oracleIndex(bytes32 data) internal pure returns (uint256) {
        return data.decodeUint10(_ORACLE_INDEX_OFFSET);
    }

    /**
     * @dev Returns the swap fee percentage.
     */
    function swapFeePercentage(bytes32 data) internal pure returns (uint256) {
        return data.decodeUint64(_SWAP_FEE_PERCENTAGE_OFFSET);
    }

    /**
     * @dev Sets the logarithm of the invariant in `data`, returning the updated value.
     */
    function setLogInvariant(bytes32 data, int256 _logInvariant) internal pure returns (bytes32) {
        return data.insertInt22(_logInvariant, _LOG_INVARIANT_OFFSET);
    }

    /**
     * @dev Sets the logarithm of the total supply in `data`, returning the updated value.
     */
    function setLogTotalSupply(bytes32 data, int256 _logTotalSupply) internal pure returns (bytes32) {
        return data.insertInt22(_logTotalSupply, _LOG_TOTAL_SUPPLY_OFFSET);
    }

    /**
     * @dev Sets the timestamp of the creation of the oracle's latest sample in `data`, returning the updated value.
     */
    function setOracleSampleCreationTimestamp(bytes32 data, uint256 _initialTimestamp) internal pure returns (bytes32) {
        return data.insertUint31(_initialTimestamp, _ORACLE_SAMPLE_CREATION_TIMESTAMP_OFFSET);
    }

    /**
     * @dev Sets the index of the  oracle's latest sample in `data`, returning the updated value.
     */
    function setOracleIndex(bytes32 data, uint256 _oracleIndex) internal pure returns (bytes32) {
        return data.insertUint10(_oracleIndex, _ORACLE_INDEX_OFFSET);
    }

    /**
     * @dev Sets the swap fee percentage in `data`, returning the updated value.
     */
    function setSwapFeePercentage(bytes32 data, uint256 _swapFeePercentage) internal pure returns (bytes32) {
        return data.insertUint64(_swapFeePercentage, _SWAP_FEE_PERCENTAGE_OFFSET);
    }
}