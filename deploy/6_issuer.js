const config = require("./.deployrc");

const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const poolFactory = await ethers.getContract("PoolFactory");
  const splitter = await ethers.getContract("Splitter");

  await deploy("Issuer", {
    from: deployer,
    args: [config.balancer.rinkeby.vault, poolFactory.address, splitter.address, config.bank, config.issuer.protocolFee],
    log: true,
  });
};

module.exports = func;
func.tags = ["issuer"];
