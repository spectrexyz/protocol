const config = require("./.deployrc");

const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("Splitter", {
    from: deployer,
    args: [config.bank, config.splitter.fee],
    log: true,
  });
};

module.exports = func;
func.tags = ["splitter"];
