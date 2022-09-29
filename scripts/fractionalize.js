const chalk = require("chalk");
const hre = require("hardhat");

const terminal = {
  address: (address) => {
    switch (address) {
      case this.sERC20.address:
        terminal.info(`${address} [sERC20]`);
        break;
      case this.broker.address:
        terminal.info(`${address} [broker]`);
        break;
      case this.vault.address:
        terminal.info(`${address} [vault]`);
        break;
      case this.splitter.address:
        terminal.info(`${address} [splitter]`);
        break;
      case this.issuer.address:
        terminal.info(`${address} [issuer]`);
        break;
      case this.broker.address:
        terminal.info(`${address} [broker]`);
        break;
      case this.poolFactory.address:
        terminal.info(`${address} [poolFactory]`);
        break;
      default:
        terminal.info(address);
    }
  },
  print: (msg) => {
    process.stdout.write(msg);
  },
  info: (msg) => {
    console.log(msg);
  },
  newline: () => {
    console.log("");
  },
  success: (msg) => {
    console.log(chalk.green(msg));
  },
  title: (msg) => {
    console.log(chalk.cyan(`-]] ${msg.toUpperCase()} [[-`));
    console.log(chalk.cyan(`--------------`));
  },
  subtitle: (msg) => {
    console.log(chalk.yellow(msg));
  },
  error: (msg) => {
    console.log(chalk.red(msg));
  },
};

const data = {
  guardian: "0x8873b045d40a458e46e356a96279ae1820a898ba",
  name: "NFT Fraction",
  symbol: "Frac",
  cap: ethers.utils.parseEther("1000000"),
  buyoutReserve: ethers.utils.parseEther("100"),
  multiplier: ethers.utils.parseEther("1.5"),
  timelock: ethers.BigNumber.from("864000"), // 10 days
  sMaxNormalizedWeight: ethers.BigNumber.from("800000000000000000"),
  sMinNormalizedWeight: ethers.BigNumber.from("500000000000000000"),
  beneficiaries: ["0x8873b045d40a458e46e356a96279ae1820a898ba"],
  shares: [ethers.utils.parseEther("15")],
  swapFeePercentage: ethers.BigNumber.from("10000000000000000"),
  issuanceReserve: ethers.utils.parseEther("100"),
  fee: ethers.utils.parseEther("5"),
  buyoutFlash: true,
  issuanceFlash: true,
};

const approve = async () => {
  const sERC721 = await ethers.getContract("sERC721");
  const vault = await ethers.getContract("Vault");

  terminal.print("» Approving vault to transfer NFTs ... ");
  const tx = await sERC721.setApprovalForAll(vault.address, true);
  await tx.wait();
  terminal.success("OK");
};

const fractionalize = async () => {
  const sERC721 = await ethers.getContract("sERC721");
  const channeler = await ethers.getContract("Channeler");
  const vault = await ethers.getContract("Vault");

  if (!process.env.TOKEN_URI) {
    throw new Error("The TOKEN_URI environment variable is missing.");
  }

  terminal.print(`» Fractionalizing NFT with URI ${process.env.TOKEN_URI} ... `);
  const tx = await channeler.mintAndFractionalize(process.env.TOKEN_URI, data);
  await tx.wait();
  terminal.success("OK");

  const events1 = (await sERC721.queryFilter(sERC721.filters.Transfer())).filter((event) => event.event === "Transfer");
  const tokenId = events1[events1.length - 1].args.tokenId;

  const events2 = (await vault.queryFilter(vault.filters.Fractionalize())).filter((event) => event.event === "Fractionalize");
  const id = events2[events2.length - 1].args.id;
  const sERC20Address = await vault.sERC20Of(id);

  terminal.info(`»» ERC721: https://testnets.opensea.io/assets/${sERC721.address}/${tokenId.toString()}`);
  terminal.info(`»» ERC1155: https://testnets.opensea.io/assets/${vault.address}/${id.toString()}`);
  terminal.info(`»» sERC20: https://${hre.network.name}.etherscan.io/token/${sERC20Address}`);

  return sERC20Address;
};

const issue = async (sERC20) => {
  const value = ethers.utils.parseEther("0.1");
  const expected = ethers.BigNumber.from("0");
  const issuer = await ethers.getContract("Issuer");

  terminal.print(`» Buying ${ethers.utils.formatEther(value)} ETH worth of sEC20 ... `);
  const tx = await issuer.issue(sERC20, expected, { value: value });
  await tx.wait();
  terminal.success("OK");
};

const main = async () => {
  // await approve();
  const sERC20 = await fractionalize();
  await issue(sERC20);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    terminal.error(error.message);
    process.exit(1);
  });
