module.exports = {
  params: {
    shares: [ethers.utils.parseEther("30"), ethers.utils.parseEther("10"), ethers.utils.parseEther("60")],
  },
  constants: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    REGISTER_ROLE: ethers.BigNumber.from("0xd1f21ec03a6eb050fba156f5316dad461735df521fb446dd42c5a4728e9c70fe"),
  },
};
