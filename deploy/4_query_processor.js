const config = require("./.deployrc");

const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("QueryProcessor", {
    from: deployer,
    log: true,
  });
};

module.exports = func;
func.tags = ["query_processor"];
