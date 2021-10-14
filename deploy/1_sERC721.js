const config = require("./.deployrc");

const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("sERC721", {
    from: deployer,
    args: [config.sERC721.name, config.sERC721.symbol],
    log: true,
  });
};

module.exports = func;
func.tags = ["sERC721"];
