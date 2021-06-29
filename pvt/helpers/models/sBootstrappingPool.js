const _Authorizer_ = require('@spectrexyz/protocol-bootstrapping-pool/artifacts/@balancer-labs/v2-vault/contracts/Authorizer.sol/Authorizer.json');
const _OracleMock_ = require('@spectrexyz/protocol-bootstrapping-pool/artifacts/contracts/test/OracleMock.sol/OracleMock.json');
const _sBootstrappingPool_ = require('@spectrexyz/protocol-bootstrapping-pool/artifacts/contracts/SpectralizationBootstrappingPool.sol/SpectralizationBootstrappingPool.json');
const _Vault_ = require('@spectrexyz/protocol-bootstrapping-pool/artifacts/@balancer-labs/v2-vault/contracts/Vault.sol/Vault.json');
const _WETH_ = require('@spectrexyz/protocol-bootstrapping-pool/artifacts/contracts/test/WETH.sol/WETH.json');
const Decimal = require('decimal.js');
const { ethers } = require('ethers');

class sBootstrappingPool {
  constructor(ctx, sERC20IsToken0) {
    this.ctx = ctx;
    this.contract = ctx.contracts.sBootstrappingPool;
    this.sERC20IsToken0 = sERC20IsToken0;

    this.getPoolId = this.contract.getPoolId;
    this.getInvariant = this.contract.getInvariant;
    this.getLastInvariant = this.contract.getLastInvariant;
    this.getLatest = this.contract.getLatest;
    this.getMiscData = this.contract.getMiscData;
    this.getNormalizedWeights = this.contract.getNormalizedWeights;
    this.totalSupply = this.contract.totalSupply;
  }

  static async deploy(ctx, opts) {
    let token0, token1, sERC20IsToken0;
    opts.mint ??= true;

    ctx.contracts.Authorizer = await waffle.deployContract(ctx.signers.root, _Authorizer_, [ctx.signers.root.address]);
    ctx.contracts.OracleMock = await waffle.deployContract(ctx.signers.root, _OracleMock_);
    ctx.contracts.WETH = await waffle.deployContract(ctx.signers.root, _WETH_);
    ctx.contracts.Vault = await waffle.deployContract(ctx.signers.root, _Vault_, [ctx.contracts.Authorizer.address, ctx.contracts.WETH.address, 0, 0]);

    if (!opts.spectralize) await ctx.sERC1155.spectralize();
    if (opts.mint) await ctx.sERC20.mint();

    if (ethers.BigNumber.from(ctx.contracts.WETH.address).lte(ethers.BigNumber.from(ctx.contracts.sERC20.address))) {
      token0 = ctx.contracts.WETH.address;
      token1 = ctx.contracts.sERC20.address;
      sERC20IsToken0 = false;
    } else {
      token0 = ctx.contracts.sERC20.address;
      token1 = ctx.contracts.WETH.address;
      sERC20IsToken0 = true;
    }

    ctx.contracts.sBootstrappingPool = await waffle.deployContract(ctx.signers.root, _sBootstrappingPool_, [
      ctx.contracts.Vault.address,
      ctx.params.sBootstrappingPool.name,
      ctx.params.sBootstrappingPool.symbol,
      token0,
      token1,
      ctx.params.sBootstrappingPool.normalizedStartWeight,
      ctx.params.sBootstrappingPool.normalizedEndWeight,
      ctx.params.sBootstrappingPool.swapFeePercentage,
      ctx.params.sBootstrappingPool.pauseWindowDuration,
      ctx.params.sBootstrappingPool.bufferPeriodDuration,
      sERC20IsToken0,
    ]);

    await ctx.sERC20.approve();

    ctx.sBootstrappingPool = new sBootstrappingPool(ctx, sERC20IsToken0);
  }

  async pokeWeights() {
    this.ctx.data.tx = await this.contract.pokeWeights();
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async join(opts = {}) {
    const JOIN_KIND_INIT = 0;
    const JOIN_EXACT_TOKENS = 1;
    const JOIN_EXACT_BPT = 2;

    opts.from ??= this.ctx.signers.holders[0];
    opts.init ??= false;

    let token0, token1, amount0, amount1;

    if (ethers.BigNumber.from(this.ctx.contracts.WETH.address).lte(ethers.BigNumber.from(this.ctx.contracts.sERC20.address))) {
      token0 = ethers.constants.AddressZero;
      token1 = this.ctx.contracts.sERC20.address;
      amount0 = this.ctx.params.sBootstrappingPool.pooled.ETH;
      amount1 = this.ctx.params.sBootstrappingPool.pooled.sERC20;
    } else {
      token0 = this.ctx.contracts.sERC20.address;
      token1 = ethers.constants.AddressZero;
      amount0 = this.ctx.params.sBootstrappingPool.pooled.sERC20;
      amount1 = this.ctx.params.sBootstrappingPool.pooled.ETH;
    }

    const joinPoolRequest = {
      assets: [token0, token1],
      maxAmountsIn: [amount0, amount1],
      userData: ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [opts.init ? JOIN_KIND_INIT : JOIN_EXACT_TOKENS, [amount0, amount1]]),
      fromInternalBalance: false,
    };

    this.ctx.data.tx = await this.ctx.contracts.Vault.connect(opts.from).joinPool(this.ctx.data.poolId, opts.from.address, opts.from.address, joinPoolRequest, {
      value: this.ctx.params.sBootstrappingPool.pooled.ETH,
    });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async pairPrice() {
    const BASE = new Decimal(10).pow(new Decimal(18));
    const { balances } = await this.ctx.contracts.Vault.getPoolTokens(this.ctx.data.poolId);
    const weights = await this.getNormalizedWeights();

    const numerator = this._decimal(balances[0]).div(this._decimal(weights[0]).div(BASE));
    const denominator = this._decimal(balances[1]).div(this._decimal(weights[1]).div(BASE));

    return this._bn(numerator.mul(BASE).div(denominator));
  }

  async BTPPrice() {
    const BASE = new Decimal(10).pow(new Decimal(18));
    const { balances } = await this.ctx.contracts.Vault.getPoolTokens(this.ctx.data.poolId);
    const weights = await this.getNormalizedWeights();
    const totalSupply = await this.totalSupply();

    return this._bn(
      this._decimal(balances[0])
        .mul(BASE)
        .div(this._decimal(weights[0]).div(BASE))
        .div(this._decimal(totalSupply))
    );
  }

  async expectedWeights(pct) {
    const ONE = this._decimal(this.ctx.constants.sBootstrappingPool.ONE);

    const cap = this._decimal(await this.ctx.sERC20.cap());
    const supply = this._decimal(await this.ctx.sERC20.totalSupply());

    const delta = this._decimal(this.ctx.params.sBootstrappingPool.normalizedEndWeight.sub(this.ctx.params.sBootstrappingPool.normalizedStartWeight));
    const gamma = delta.mul(supply);

    const sWeight = this._decimal(this.ctx.params.sBootstrappingPool.normalizedStartWeight).add(gamma.div(cap));
    const eWeight = ONE.sub(sWeight);

    return this.sERC20IsToken0 ? [this._bn(sWeight), this._bn(eWeight)] : [this._bn(eWeight), this._bn(sWeight)];
  }

  _decimal(number) {
    return new Decimal(number.toString());
  }

  _bn(number) {
    return ethers.BigNumber.from(number.toFixed(0).toString());
  }
}

module.exports = sBootstrappingPool;
