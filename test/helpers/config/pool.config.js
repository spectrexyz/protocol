const { ethers } = require("ethers");

module.exports = {
  params: {
    name: "Fractionalization Bootstrapping Pool Token",
    symbol: "FBPT",
    sMaxNormalizedWeight: ethers.BigNumber.from("800000000000000000"),
    sMinNormalizedWeight: ethers.BigNumber.from("200000000000000000"),
    swapFeePercentage: ethers.BigNumber.from("10000000000000000"),
    pauseWindowDuration: ethers.BigNumber.from("3000"),
    bufferPeriodDuration: ethers.BigNumber.from("1000"),
    pooled: {
      ETH: ethers.utils.parseEther("1"),
      sERC20: ethers.utils.parseEther("4"),
    },
  },
  constants: {
    TWO_TOKEN_POOL: 2,
    ONE: ethers.utils.parseEther("1"),
    MIN_SWAP_FEE_PERCENTAGE: ethers.BigNumber.from("1000000000000"),
    MAX_SWAP_FEE_PERCENTAGE: ethers.BigNumber.from("100000000000000000"),
    MIN_WEIGHT: ethers.BigNumber.from("10000000000000000"),
    ORACLE_VARIABLE: {
      PAIR_PRICE: 0,
      BPT_PRICE: 1,
      INVARIANT: 2,
    },
  },
};
