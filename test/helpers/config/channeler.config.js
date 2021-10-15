module.exports = {
  params: {
    reserve: ethers.utils.parseEther("2.5"),
    multiplier: ethers.utils.parseEther("1.5"),
    timelock: ethers.BigNumber.from("1209600"), // two weeks
    value: ethers.utils.parseEther("10"),
    balance: ethers.utils.parseEther("1"),
    lifespan: ethers.BigNumber.from("3600"),
    protocolFee: ethers.utils.parseEther("10"),
    tokenURI: "ipfs://myawesomefractionalizedNFT",
  },
  constants: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    DECIMALS: ethers.utils.parseEther("1"),
    HUNDRED: ethers.utils.parseEther("100"),
  },
};
