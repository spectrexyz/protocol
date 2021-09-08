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
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    REGISTER_ROLE: ethers.BigNumber.from("0xd1f21ec03a6eb050fba156f5316dad461735df521fb446dd42c5a4728e9c70fe"),
    ESCAPE_ROLE: ethers.BigNumber.from("0x12630b13fc535892fff29cd260a4eee87eac2069149688d850fa73ac0322e120"),
    DECIMALS: ethers.BigNumber.from("1000000000000000000"),
    sales: {
      state: {
        Pending: 1,
        Opened: 2,
        Closed: 3,
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
