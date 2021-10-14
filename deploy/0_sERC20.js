const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("sERC20", {
    from: deployer,
    log: true,
  });
};

module.exports = func;
func.tags = ["sERC20"];
