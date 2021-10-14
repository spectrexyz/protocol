const config = require("./.deployrc");

const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const vault = await ethers.getContract("Vault");
  const issuer = await ethers.getContract("Issuer");

  await deploy("Broker", {
    from: deployer,
    args: [vault.address, issuer.address, config.bank, config.broker.protocolFee],
    log: true,
  });
};

module.exports = func;
func.tags = ["broker"];
