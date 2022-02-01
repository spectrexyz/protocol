const config = require("./.deployrc");

const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const queryProcessor = await ethers.getContract("QueryProcessor");

  await deploy("PoolFactory", {
    contract: "FractionalizationBootstrappingPoolFactory",
    from: deployer,
    args: [config.balancer.rinkeby.vault, deployer],
    log: true,
    libraries: {
      QueryProcessor: queryProcessor.address,
    },
  });
};

module.exports = func;
func.tags = ["pool_factory"];
