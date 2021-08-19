const advanceTime = async (seconds) => {
  await ethers.provider.send('evm_increaseTime', [parseInt(seconds.toString())]);
  await ethers.provider.send('evm_mine', []);
};

const currentTimestamp = async () => {
  const { timestamp } = await network.provider.send('eth_getBlockByNumber', ['latest', true]);
  return ethers.BigNumber.from(timestamp);
};

module.exports = {
  advanceTime,
  currentTimestamp,
};
