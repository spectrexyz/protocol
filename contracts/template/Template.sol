// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.0;

// import "../broker/interfaces/0.7/IBroker.sol";
// import "../token/interfaces/0.7/sIERC20.sol";
// import "../vault/interfaces/0.7/IVault.sol";
// import "../market/sBootstrappingPool.sol";
// import "../market/interfaces/sIMinter.sol";
// import "../utils/interfaces/0.7/ISplitter.sol";
import "@openzeppelin/contracts-0.7/access/AccessControl.sol";
import "@openzeppelin/contracts-0.7/utils/Context.sol";

/**
 * @title  sSplitter
 * @notice Split sERC20s between registered beneficiaries when received.
 */
contract Template is Context, AccessControl {
    // bytes32 private constant BURN_ROLE = keccak256("BURN_ROLE");
    // bytes32 private constant MINT_ROLE = keccak256("MINT_ROLE");

    // sIERC1155 private immutable _sERC1155;
    // IFlashBroker private immutable _broker;
    // sIMinter private immutable _minter;
    // ISplitter private immutable _splitter;
    // IVault private immutable _vault;
    // IERC20 private immutable _weth;

    // constructor(
    //     address sERC1155,
    //     address minter,
    //     address broker,
    //     address weth,
    //     address splitter,
    //     address vault
    // ) {
    //     _sERC1155 = sIERC1155(sERC1155);
    //     _minter = sIMinter(minter);
    //     _broker = IFlashBroker(broker);
    //     _weth = IERC20(weth);
    //     _splitter = ISplitter(splitter);
    //     _vault = IVault(vault);
    // }

    // function spectralize(
    //     address collection,
    //     uint256 tokenId,
    //     string memory name,
    //     string memory symbol,
    //     uint256 cap,
    //     uint256 multiplier,
    //     uint256 timeframe,
    //     address payable beneficiary,
    //     address[] calldata beneficiaries,
    //     uint256[] calldata shares,
    //     uint256 initialPrice,
    //     uint256 fee
    // ) external {
    //     address sERC20 = _spectralize(collection, tokenId, name, symbol, cap);
    //     // grant sERC20 roles
    //     sIERC20(sERC20).grantRole(MINT_ROLE, address(_minter));
    //     sIERC20(sERC20).grantRole(BURN_ROLE, address(_broker));
    //     // deploy pool
    //     sBootstrappingPool pool = new sBootstrappingPool(_vault, name, symbol, IERC20(sERC20), _weth, 0, 0, 10, 0, 0, true);
    //     // constructor(
    //     //     IVault  vault,
    //     //     string  memory name,
    //     //     string  memory symbol,
    //     //     IERC20  token0,
    //     //     IERC20  token1,
    //     //     uint256 sERC20MaxWeight,
    //     //     uint256 sERC20MinWeight,
    //     //     uint256 swapFeePercentage,
    //     //     uint256 pauseWindowDuration,
    //     //     uint256 bufferPeriodDuration,
    //     //     bool    sERC20IsToken0
    //     // )
    //     //register sERC20 in sSplitter
    //     _splitter.register(sIERC20(sERC20), beneficiaries, shares);
    //     // register sERC20 in sFlashBuyout
    //     // _broker.register(
    //     //     sERC20,
    //     //     /* to update when pool are ready */
    //     //     address(this),
    //     //     multiplier,
    //     //     timeframe
    //     // );
    //     // register sERC20 in sMinter
    //     _minter.register(sERC20, address(pool), beneficiary, initialPrice, shares[0], fee);
    // }

    // //     sIERC1155 private immutable _sERC1155;
    // // IFlashBroker private immutable _broker;
    // // sIMinter private immutable _minter;
    // // sISplitter private immutable _splitter;
    // // IVault private immutable _vault;
    // // IERC20 private immutable _weth;

    // /* #region getter functions */
    // function sERC1155() public view returns (address) {
    //     return address(_sERC1155);
    // }

    // /* #endregion */

    // function _spectralize(
    //     address collection,
    //     uint256 tokenId,
    //     string memory name,
    //     string memory symbol,
    //     uint256 cap
    // ) private returns (address) {
    //     uint256 id = _sERC1155.spectralize(collection, tokenId, name, symbol, cap, address(this), address(_broker));
    //     return _sERC1155.sERC20Of(id);
    // }
}
