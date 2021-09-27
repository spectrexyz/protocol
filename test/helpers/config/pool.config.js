module.exports = {
  params: {
    name: "Fractionalization Bootstrapping Pool Token",
    symbol: "FBPT",
    sMaxNormalizedWeight: ethers.BigNumber.from("600000000000000000"),
    sMinNormalizedWeight: ethers.BigNumber.from("300000000000000000"),
    swapFeePercentage: ethers.BigNumber.from("10000000000000000"),
    pauseWindowDuration: ethers.BigNumber.from("3000"),
    bufferPeriodDuration: ethers.BigNumber.from("1000"),
  },
  constants: {},
};
