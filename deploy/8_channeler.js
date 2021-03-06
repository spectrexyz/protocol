const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const sERC721 = await ethers.getContract("sERC721");
  const vault = await ethers.getContract("Vault");
  const issuer = await ethers.getContract("Issuer");
  const broker = await ethers.getContract("Broker");
  const splitter = await ethers.getContract("Splitter");

  await deploy("Channeler", {
    from: deployer,
    args: [sERC721.address, vault.address, issuer.address, broker.address, splitter.address],
    log: true,
  });
};

module.exports = func;
func.tags = ["channeler"];
