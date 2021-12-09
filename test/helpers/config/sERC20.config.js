module.exports = {
  params: {
    name: "My Awesome sERC20",
    symbol: "MAS",
    cap: ethers.utils.parseEther("1000"),
    balance: ethers.BigNumber.from("100000000000000000000"),
    amount: ethers.BigNumber.from("10000000000000000000"),
  },
  constants: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    MINT_ROLE: ethers.BigNumber.from("0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686"),
    PAUSE_ROLE: ethers.BigNumber.from("0x139c2898040ef16910dc9f44dc697df79363da767d8bc92f2e310312b816e46d"),
    SNAPSHOT_ROLE: ethers.BigNumber.from("0x5fdbd35e8da83ee755d5e62a539e5ed7f47126abede0b8b10f9ea43dc6eed07f"),
  },
};
