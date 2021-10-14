const chalk = require("chalk");
const config = require("./deploy.config");
async function main() {
  const _sERC20_ = await ethers.getContractFactory("sERC20");
  const _Vault_ = await ethers.getContractFactory("contracts/vault/Vault.sol:Vault");

  const sERC20 = await _sERC20_.deploy();
  await sERC20.deployTransaction.wait();
  const vault = await _Vault_.deploy(sERC20.address, config.vault.unavailableURI, config.vault.unlockedURI);
  await vault.deployTransaction.wait();

  console.log(`${chalk.cyan("[sERC20]")} ${sERC20.address}`);
  console.log(`${chalk.cyan("[vault]")} ${vault.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
