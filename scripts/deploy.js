const chalk = require("chalk");
const fs = require("fs");
const config = require("./deploy.config");

const terminal = {
  info: (msg) => {
    process.stdout.write(`${msg} ... `);
  },
  success: (msg) => {
    console.log(chalk.green(msg));
  },
  error: (msg) => {
    console.log(chalk.red(msg));
  },
};

const save = async () => {
  const path = `./deployments/${this.timestamp}.json`;
  const data = JSON.stringify({
    sERC20: this.sERC20.address,
    sERC721: this.sERC721.address,
    broker: this.broker.address,
    channeler: this.channeler.address,
    issuer: this.issuer.address,
    queryProcessor: this.queryProcessor.address,
    poolFactory: this.poolFactory.address,
    splitter: this.splitter.address,
    vault: this.vault.address,
  });
  fs.writeFileSync(path, data);
};

const deploy = async () => {
  this.timestamp = Date.now();

  const _sERC20_ = await ethers.getContractFactory("sERC20");
  const _sERC721_ = await ethers.getContractFactory("sERC721");
  const _Broker_ = await ethers.getContractFactory("contracts/broker/Broker.sol:Broker");
  const _Channeler_ = await ethers.getContractFactory("contracts/channeler/Channeler.sol:Channeler");
  const _Issuer_ = await ethers.getContractFactory("contracts/issuer/Issuer.sol:Issuer");
  const _Splitter_ = await ethers.getContractFactory("contracts/utils/Splitter.sol:Splitter");
  const _Vault_ = await ethers.getContractFactory("contracts/vault/Vault.sol:Vault");
  const _QueryProcessor_ = await ethers.getContractFactory("@balancer-labs/v2-pool-utils/contracts/oracle/QueryProcessor.sol:QueryProcessor");

  terminal.info("» Deploying sERC20");
  this.sERC20 = await _sERC20_.deploy();
  await this.sERC20.deployTransaction.wait();
  terminal.success(this.sERC20.address);

  terminal.info("» Deploying sERC721");
  this.sERC721 = await _sERC721_.deploy(config.sERC721.name, config.sERC721.symbol);
  await this.sERC721.deployTransaction.wait();
  terminal.success(this.sERC721.address);

  terminal.info("» Deploying vault");
  this.vault = await _Vault_.deploy(this.sERC20.address, config.vault.unavailableURI, config.vault.unlockedURI);
  await this.vault.deployTransaction.wait();
  terminal.success(this.vault.address);

  terminal.info("» Deploying splitter");
  this.splitter = await _Splitter_.deploy(config.bank, config.splitter.fee);
  await this.splitter.deployTransaction.wait();
  terminal.success(this.splitter.address);

  terminal.info("» Deploying queryProcessor");
  this.queryProcessor = await _QueryProcessor_.deploy();
  await this.queryProcessor.deployTransaction.wait();
  terminal.success(this.queryProcessor.address);

  terminal.info("» Deploying poolFactory");
  const _PoolFactory_ = await ethers.getContractFactory(
    "contracts/pool/FractionalizationBootstrappingPoolFactory.sol:FractionalizationBootstrappingPoolFactory",
    {
      libraries: {
        QueryProcessor: this.queryProcessor.address,
      },
    }
  );
  this.poolFactory = await _PoolFactory_.deploy(config.balancer.rinkeby.vault);
  await this.poolFactory.deployTransaction.wait();
  terminal.success(this.poolFactory.address);

  terminal.info("» Deploying issuer");
  this.issuer = await _Issuer_.deploy(config.balancer.rinkeby.vault, this.poolFactory.address, this.splitter.address, config.bank, config.issuer.fee);
  await this.issuer.deployTransaction.wait();
  terminal.success(this.issuer.address);

  terminal.info("» Deploying broker");
  this.broker = await _Broker_.deploy(this.vault.address, this.issuer.address, config.bank, config.broker.fee);
  await this.broker.deployTransaction.wait();
  terminal.success(this.broker.address);

  terminal.info("» Deploying channeler");
  this.channeler = await _Channeler_.deploy(this.vault.address, this.issuer.address, this.broker.address, this.splitter.address);
  await this.channeler.deployTransaction.wait();
  terminal.success(this.channeler.address);
};

const grantRole = async () => {};

const main = async () => {
  await deploy();
  await save();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    terminal.error(error.message);
    process.exit(1);
  });
