const chalk = require("chalk");

const roles = {
  sERC721: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    MINT_ROLE: ethers.BigNumber.from("0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686"),
  },
  broker: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    REGISTER_ROLE: ethers.BigNumber.from("0xd1f21ec03a6eb050fba156f5316dad461735df521fb446dd42c5a4728e9c70fe"),
    ESCAPE_ROLE: ethers.BigNumber.from("0x12630b13fc535892fff29cd260a4eee87eac2069149688d850fa73ac0322e120"),
  },
  issuer: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    CLOSE_ROLE: ethers.BigNumber.from("0x78844962b347caf400e109846dc948d8df0fc5b2f795edb688517fc687580cd4"),
    REGISTER_ROLE: ethers.BigNumber.from("0xd1f21ec03a6eb050fba156f5316dad461735df521fb446dd42c5a4728e9c70fe"),
  },
  splitter: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    REGISTER_ROLE: ethers.BigNumber.from("0xd1f21ec03a6eb050fba156f5316dad461735df521fb446dd42c5a4728e9c70fe"),
  },
  channeler: {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
  },
  vault: {
    FRACTIONALIZE_ROLE: ethers.BigNumber.from("0xa541cf2e8e137aa2a6ee62088e1847ecf1f039943f142d77fcf83c401b25d3cf"),
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
  },
};

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

const fetch = {
  all: async () => {
    this.sERC20 = await ethers.getContract("sERC20");
    this.sERC721 = await ethers.getContract("sERC721");
    this.vault = await ethers.getContract("Vault");
    this.broker = await ethers.getContract("Broker");
    this.issuer = await ethers.getContract("Issuer");
    this.splitter = await ethers.getContract("Splitter");
    this.poolFactory = await ethers.getContract("PoolFactory");
    this.channeler = await ethers.getContract("Channeler");
  },
};

const grant = {
  sERC721: async () => {
    terminal.print("» Granting MINT_ROLE over sERC721 to channeler ... ");
    const tx = await this.sERC721.grantRole(roles.sERC721.MINT_ROLE, this.channeler.address);
    await tx.wait();
    terminal.success("OK");
  },
  broker: async () => {
    terminal.print("» Granting REGISTER_ROLE over broker to channeler ... ");
    const tx = await this.broker.grantRole(roles.broker.REGISTER_ROLE, this.channeler.address);
    await tx.wait();
    terminal.success("OK");
  },
  issuer: async () => {
    terminal.print("» Granting REGISTER_ROLE over issuer to channeler ... ");
    const tx1 = await this.issuer.grantRole(roles.issuer.REGISTER_ROLE, this.channeler.address);
    await tx1.wait();
    terminal.success("OK");
    terminal.print("» Granting CLOSE_ROLE over issuer to broker ... ");
    const tx2 = await this.issuer.grantRole(roles.issuer.CLOSE_ROLE, this.broker.address);
    await tx2.wait();
    terminal.success("OK");
  },
  splitter: async () => {
    terminal.print("» Granting REGISTER_ROLE over splitter to channeler ... ");
    const tx = await this.splitter.grantRole(roles.splitter.REGISTER_ROLE, this.channeler.address);
    await tx.wait();
    terminal.success("OK");
  },
  vault: async () => {
    terminal.print("» Granting FRACTIONALIZE_ROLE over vault to channeler ... ");
    const tx = await this.vault.grantRole(roles.vault.FRACTIONALIZE_ROLE, this.channeler.address);
    await tx.wait();
    terminal.success("OK");
  },
};

const main = async () => {
  await fetch.all();
  await grant.sERC721();
  await grant.broker();
  await grant.issuer();
  await grant.splitter();
  await grant.vault();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    terminal.error(error.message);
    process.exit(1);
  });
