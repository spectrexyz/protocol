module.exports = {
  params: {
    reserve: ethers.utils.parseEther("2.5"),
    multiplier: ethers.utils.parseEther("1.5"),
    timelock: ethers.BigNumber.from("1209600"), // two weeks
    value: ethers.utils.parseEther("10"),
    balance: ethers.utils.parseEther("1"),
    lifespan: ethers.BigNumber.from("3600"),
  },
  constants: {
    DECIMALS: ethers.BigNumber.from("1000000000000000000"),
    sales: {
      state: {
        PENDING: 1,
        OPEN: 2,
        CLOSED: 3,
      },
    },
    proposals: {
      state: {
        Null: 0,
        Pending: 1,
        Accepted: 2,
        Rejected: 3,
        Lapsed: 4,
        Withdrawn: 5,
      },
    },
  },
};
