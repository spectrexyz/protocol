module.exports = {
  params: {
    name: "sERC721 Collection",
    symbol: "SERC721",
    tokenURI: "ipfs://Qm.../",
  },
  constants: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    MINT_ROLE: ethers.BigNumber.from("0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686"),
  },
};
