const { ethers } = require("ethers");

module.exports = {
  params: {
    reserve: ethers.utils.parseEther("0.1"),
    multiplier: ethers.utils.parseEther("1.5"),
    timelock: ethers.BigNumber.from("1209600"), // two weeks
    value: ethers.utils.parseEther("10"),
    price: ethers.utils.parseEther("0.01"),
    reserve: ethers.utils.parseEther("0.1"),
    lifespan: ethers.BigNumber.from("3600"),
    protocolFee: ethers.utils.parseEther("10"),
    fee: ethers.utils.parseEther("5"),
    allocation: ethers.utils.parseEther("15"),
  },
  constants: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    CLOSE_ROLE: ethers.BigNumber.from("0x78844962b347caf400e109846dc948d8df0fc5b2f795edb688517fc687580cd4"),
    REGISTER_ROLE: ethers.BigNumber.from("0xd1f21ec03a6eb050fba156f5316dad461735df521fb446dd42c5a4728e9c70fe"),
    DECIMALS: ethers.utils.parseEther("1"),
    HUNDRED: ethers.utils.parseEther("100"),
    TwapKind: {
      ETH: 0,
      sERC20: 1,
    },
    issuances: {
      state: {
        Null: 0,
        Opened: 1,
        Closed: 2,
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
