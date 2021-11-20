module.exports = {
  params: {
    unlockedURI: "ipfs://Qm.../unwrapped",
    unavailableURI: "ipfs://Qm.../unavailable",
    amount: ethers.utils.parseEther("10"),
    amount1: ethers.utils.parseEther("70"),
    amount2: ethers.utils.parseEther("12"),
    amount3: ethers.utils.parseEther("1"),
    amount4: ethers.utils.parseEther("3"),
  },
  constants: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    FRACTIONALIZE_ROLE: ethers.BigNumber.from("0xa541cf2e8e137aa2a6ee62088e1847ecf1f039943f142d77fcf83c401b25d3cf"),
    DERRIDA: "0x1d2496c631fd6d8be20fb18c5c1fa9499e1f28016c62da960ec6dcf752f2f7ce",
    spectres: {
      state: {
        Null: 0,
        Locked: 1,
        Unlocked: 2,
      },
    },
  },
};
