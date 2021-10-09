module.exports = {
  params: {
    shares: [ethers.utils.parseEther("5"), ethers.utils.parseEther("15"), ethers.utils.parseEther("20")],
    fee: ethers.utils.parseEther("5"),
  },
  constants: {
    HUNDRED: ethers.utils.parseEther("100"),
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    REGISTER_ROLE: ethers.BigNumber.from("0xd1f21ec03a6eb050fba156f5316dad461735df521fb446dd42c5a4728e9c70fe"),
  },
};
