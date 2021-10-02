const _Authorizer_ = require("../../../artifacts/@balancer-labs/v2-vault/contracts/Authorizer.sol/Authorizer.json");
const _Vault_ = require("../../../artifacts/@balancer-labs/v2-vault/contracts/Vault.sol/Vault.json");
const _OracleMock_ = require("../../../artifacts/contracts/mock/OracleMock.sol/OracleMock.json");
const _WETH_ = require("../../../artifacts/contracts/mock/WETH.sol/WETH.json");
const _QueryProcessor_ = require("../../../artifacts/@balancer-labs/v2-pool-utils/contracts/oracle/QueryProcessor.sol/QueryProcessor.json");
const Pool = require("./pool");

class PoolFactory {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.poolFactory;
    this.address = this.contract.address;
    this.getVault = this.contract.getVault;
  }

  static async deploy(ctx, opts) {
    ctx.contracts.authorizer = await waffle.deployContract(ctx.signers.root, _Authorizer_, [ctx.signers.root.address]);
    ctx.contracts.oracleMock = await waffle.deployContract(ctx.signers.root, _OracleMock_);
    ctx.contracts.WETH = await waffle.deployContract(ctx.signers.root, _WETH_);
    ctx.contracts.bVault = await waffle.deployContract(ctx.signers.root, _Vault_, [ctx.contracts.authorizer.address, ctx.contracts.WETH.address, 0, 0]);
    // ctx.contracts.factory = await waffle.deployContract(ctx.signers.root, _PoolFactory_, [ctx.contracts.bVault.address]);
    ctx.contracts.QueryProcessor = await waffle.deployContract(ctx.signers.root, _QueryProcessor_, []);
    const PoolFactoryFactory = await ethers.getContractFactory("FractionalizationBootstrappingPoolFactory", {
      libraries: {
        QueryProcessor: ctx.contracts.QueryProcessor.address,
      },
    });
    ctx.data.tx = await PoolFactoryFactory.connect(ctx.signers.root).deploy(ctx.contracts.bVault.address);
    ctx.contracts.poolFactory = await ctx.data.tx.deployed();
    ctx.data.receipt = await ctx.data.tx.deployTransaction.wait();
    ctx.poolFactory = new PoolFactory(ctx);
  }

  async create(opts = {}) {
    let token0, token1, sERC20IsToken0;

    opts.mint ??= false;
    opts.name ??= this.ctx.params.pool.name;
    opts.symbol ??= this.ctx.params.pool.symbol;
    opts.sMaxNormalizedWeight ??= this.ctx.params.pool.sMaxNormalizedWeight;
    opts.sMinNormalizedWeight ??= this.ctx.params.pool.sMinNormalizedWeight;
    opts.swapFeePercentage ??= this.ctx.params.pool.swapFeePercentage;
    opts.pauseWindowDuration ??= this.ctx.params.pool.pauseWindowDuration;
    opts.bufferPeriodDuration ??= this.ctx.params.pool.bufferPeriodDuration;
    opts.owner ??= this.ctx.signers.pool.owner;

    if (ethers.BigNumber.from(this.ctx.contracts.WETH.address).lte(ethers.BigNumber.from(this.ctx.sERC20.address))) {
      token0 = this.ctx.contracts.WETH.address;
      token1 = this.ctx.contracts.sERC20.address;
      sERC20IsToken0 = false;
    } else {
      token0 = this.ctx.contracts.sERC20.address;
      token1 = this.ctx.contracts.WETH.address;
      sERC20IsToken0 = true;
    }

    this.ctx.data.tx = await this.contract.create(
      opts.name,
      opts.symbol,
      token0,
      token1,
      opts.sMaxNormalizedWeight,
      opts.sMinNormalizedWeight,
      opts.swapFeePercentage,
      sERC20IsToken0
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
    const pool = this.ctx.data.receipt.events.filter((event) => event.event === "CreatePool")[0].args.pool;
    this.ctx.pool = await Pool.at(this.ctx, pool, opts);
    this.ctx.pool.sERC20IsToken0 = sERC20IsToken0;
  }
}

module.exports = PoolFactory;
