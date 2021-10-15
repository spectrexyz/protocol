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
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
  },
};

const properties = {
  sERC721: {
    paused: {},
  },
  broker: {
    vault: { address: true },
    issuer: { address: true },
    bank: { address: true },
    protocolFee: { decimals: true },
  },
  issuer: {
    vault: { address: true },
    poolFactory: { address: true },
    splitter: { address: true },
    WETH: { address: true },
    bank: { address: true },
    protocolFee: { decimals: true },
  },
  channeler: {
    vault: { address: true },
    issuer: { address: true },
    broker: { address: true },
    splitter: { address: true },
    paused: {},
  },
  splitter: {
    bank: { address: true },
    protocolFee: { decimals: true },
  },
  vault: {
    sERC20Base: { address: true },
    unavailableURI: {},
    unlockedURI: {},
  },
};

const print = {
  all: async () => {
    for (const contract in this) {
      const _contract = this[contract];

      terminal.newline();
      terminal.title(contract);
      terminal.info(_contract.address);
      terminal.newline();

      for (let role in roles[contract]) {
        const _role = roles[contract]?.[role];
        const count = await _contract.getRoleMemberCount(_role);

        terminal.subtitle(role);
        for (let i = 0; i < count.toNumber(); i++) {
          terminal.address(await _contract.getRoleMember(_role, i));
        }
        terminal.newline();
      }

      for (let property in properties[contract]) {
        const _property = properties[contract]?.[property];
        const result = await _contract?.[property]();

        terminal.subtitle(property);
        if (_property.address) terminal.address(result);
        else if (_property.decimals) terminal.info(ethers.utils.formatEther(result));
        else terminal.info(result);
        terminal.newline();
      }
    }
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
      case this.channeler.address:
        terminal.info(`${address} [channeler]`);
        break;
      case this.poolFactory.address:
        terminal.info(`${address} [poolFactory]`);
        break;
      default:
        terminal.info(address);
    }
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

const main = async () => {
  process.stdout.write("\x1Bc");
  await fetch.all();
  await print.all();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    terminal.error(error.message);
    process.exit(1);
  });
