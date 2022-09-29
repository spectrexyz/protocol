const config = require("./.deployrc");

const func = async (hre) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const queryProcessor = await ethers.getContract("QueryProcessor");

  const balancerVaultAddress = config.balancer[network.name]?.vault;
  if (!balancerVaultAddress) {
    throw new Error(`Couldn’t find the Balancer vault address in the .deployrc file for network ${network.name}`);
  }

  await deploy("PoolFactory", {
    contract: "FractionalizationBootstrappingPoolFactory",
    from: deployer,
    args: [balancerVaultAddress, deployer],
    log: true,
    libraries: {
      QueryProcessor: queryProcessor.address,
    },
  });
};

module.exports = func;
func.tags = ["pool_factory"];
