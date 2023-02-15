const config = require("./.deployrc");

const func = async (hre) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const poolFactory = await ethers.getContract("PoolFactory");
  const splitter = await ethers.getContract("Splitter");

  const balancerVaultAddress = config.balancer[network.name]?.vault;
  if (!balancerVaultAddress) {
    throw new Error(
      `Couldn’t find the Balancer vault address in the .deployrc file for network ${network.name}`,
    );
  }

  const issuer = await deploy("Issuer", {
    from: deployer,
    args: [
      balancerVaultAddress,
      poolFactory.address,
      splitter.address,
      config.bank,
      config.issuer.protocolFee,
    ],
    log: true,
  });

  // Set issuer on the pool factory
  await poolFactory.setIssuer(issuer.address);
};

module.exports = func;
func.tags = ["issuer"];
