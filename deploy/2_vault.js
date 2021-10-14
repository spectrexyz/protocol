const config = require("./.deployrc");
const _Vault_ = require("../artifacts/contracts/vault/Vault.sol/Vault.json");
const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const sERC20 = await ethers.getContract("sERC20");
  await deploy("Vault", {
    contract: _Vault_,
    from: deployer,
    args: [sERC20.address, config.vault.unavailableURI, config.vault.unlockedURI],
    log: true,
  });
};

module.exports = func;
func.tags = ["vault"];
