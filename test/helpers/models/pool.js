const _Authorizer_ = require("../../../artifacts/@balancer-labs/v2-vault/contracts/Authorizer.sol/Authorizer.json");
const _Vault_ = require("../../../artifacts/@balancer-labs/v2-vault/contracts/Vault.sol/Vault.json");
const _OracleMock_ = require("../../../artifacts/contracts/mock/OracleMock.sol/OracleMock.json");
const _QueryProcessor_ = require("../../../artifacts/@balancer-labs/v2-pool-utils/contracts/oracle/QueryProcessor.sol/QueryProcessor.json");
const _WETH_ = require("../../../artifacts/contracts/mock/WETH.sol/WETH.json");
const _FractionalizationBootstrappingPool_ = require("../../../artifacts/contracts/pool/FractionalizationBootstrappingPool.sol/FractionalizationBootstrappingPool.json");
const Decimal = require("decimal.js");

class Pool {
  constructor(ctx, sERC20IsToken0) {
    this.ctx = ctx;
    this.contract = ctx.contracts.pool;
    this.address = this.contract.address;
    this.sERC20IsToken0 = sERC20IsToken0;

    this.name = this.contract.name;
    this.symbol = this.contract.symbol;
    this.decimals = this.contract.decimals;
    this.balanceOf = this.contract.balanceOf;
    this.getPoolId = this.contract.getPoolId;
    this.getInvariant = this.contract.getInvariant;
    this.getLastInvariant = this.contract.getLastInvariant;
    this.getLatest = this.contract.getLatest;
    this.getMiscData = this.contract.getMiscData;
    this.getNormalizedWeights = this.contract.getNormalizedWeights;
    this.maxWeightTokenIndex = this.contract.maxWeightTokenIndex;
    this.totalSupply = this.contract.totalSupply;
    this.getVault = this.contract.getVault;
    this.getOwner = this.contract.getOwner;
    this.getAuthorizer = this.contract.getAuthorizer;
    this.getSwapFeePercentage = this.contract.getSwapFeePercentage;
    this.getTimeWeightedAverage = this.contract.getTimeWeightedAverage;
    this.getPausedState = this.contract.getPausedState;
  }

  static async deploy(ctx, opts) {
    let token0, token1, sERC20IsToken0;

    opts.mint ??= false;
    opts.name ??= ctx.params.pool.name;
    opts.symbol ??= ctx.params.pool.symbol;
    opts.sMaxNormalizedWeight ??= ctx.params.pool.sMaxNormalizedWeight;
    opts.sMinNormalizedWeight ??= ctx.params.pool.sMinNormalizedWeight;
    opts.swapFeePercentage ??= ctx.params.pool.swapFeePercentage;
    opts.pauseWindowDuration ??= ctx.params.pool.pauseWindowDuration;
    opts.bufferPeriodDuration ??= ctx.params.pool.bufferPeriodDuration;
    opts.owner ??= ctx.signers.pool.owner;

    ctx.contracts.authorizer = await waffle.deployContract(ctx.signers.root, _Authorizer_, [ctx.signers.root.address]);
    ctx.contracts.oracleMock = await waffle.deployContract(ctx.signers.root, _OracleMock_);
    ctx.contracts.WETH = await waffle.deployContract(ctx.signers.root, _WETH_);
    ctx.contracts.bVault = await waffle.deployContract(ctx.signers.root, _Vault_, [ctx.contracts.authorizer.address, ctx.contracts.WETH.address, 0, 0]);

    if (opts.mint) await ctx.sERC20.mint();

    if (ethers.BigNumber.from(ctx.contracts.WETH.address).lte(ethers.BigNumber.from(ctx.sERC20.address))) {
      token0 = ctx.contracts.WETH.address;
      token1 = ctx.contracts.sERC20.address;
      sERC20IsToken0 = false;
    } else {
      token0 = ctx.contracts.sERC20.address;
      token1 = ctx.contracts.WETH.address;
      sERC20IsToken0 = true;
    }

    const params = {
      vault: ctx.contracts.bVault.address,
      name: opts.name,
      symbol: opts.symbol,
      token0,
      token1,
      sMaxNormalizedWeight: opts.sMaxNormalizedWeight,
      sMinNormalizedWeight: opts.sMinNormalizedWeight,
      swapFeePercentage: opts.swapFeePercentage,
      pauseWindowDuration: opts.pauseWindowDuration,
      bufferPeriodDuration: opts.bufferPeriodDuration,
      sERC20IsToken0,
      owner: opts.owner.address,
    };

    ctx.contracts.QueryProcessor = await waffle.deployContract(ctx.signers.root, _QueryProcessor_, []);
    const PoolFactory = await ethers.getContractFactory("FractionalizationBootstrappingPool", {
      libraries: {
        QueryProcessor: ctx.contracts.QueryProcessor.address,
      },
    });

    ctx.data.tx = await PoolFactory.connect(ctx.signers.root).deploy(params);
    ctx.contracts.pool = await ctx.data.tx.deployed();
    ctx.data.receipt = await ctx.data.tx.deployTransaction.wait();
    ctx.data.timestamp = ethers.BigNumber.from((await ethers.provider.getBlock(ctx.data.receipt.blockNumber)).timestamp);
    ctx.data.poolId = await ctx.contracts.pool.getPoolId();
    await ctx.sERC20.approve();

    ctx.pool = new Pool(ctx, sERC20IsToken0);
  }

  static async at(ctx, address, opts = {}) {
    opts.permissions ??= true;
    opts.root ??= ctx.signers.root;

    ctx.contracts.pool = new ethers.Contract(address, _FractionalizationBootstrappingPool_.abi, opts.root);
    ctx.data.poolId = await ctx.contracts.pool.getPoolId();

    return new Pool(ctx);
  }

  async poke() {
    this.ctx.data.tx = await this.contract.poke();
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async swap(opts = {}) {
    opts.sERC20 ??= false;
    opts.from ??= this.ctx.signers.issuer.buyer;
    opts.value ??= this.ctx.params.pool.value;
    opts.amount ??= this.ctx.params.pool.amount;

    const singleSwap = {
      poolId: this.ctx.data.poolId,
      kind: 0,
      assetIn: opts.sERC20 ? this.ctx.sERC20.address : ethers.constants.AddressZero,
      assetOut: opts.sERC20 ? ethers.constants.AddressZero : this.ctx.sERC20.address,
      amount: opts.sERC20 ? opts.amount : opts.value,
      userData: ethers.constants.HashZero,
    };

    const funds = {
      sender: opts.from.address,
      fromInternalBalance: false,
      recipient: opts.from.address,
      toInternalBalance: false,
    };

    if (opts.sERC20) {
      await this.ctx.sERC20.approve({ from: this.ctx.signers.issuer.buyer, amount: opts.amount, spender: this.ctx.contracts.bVault });
    }

    this.ctx.data.tx = await this.ctx.contracts.bVault.connect(opts.from).swap(singleSwap, funds, 0, Date.now(), {
      value: opts.sERC20 ? 0 : opts.value,
    });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async join(opts = {}) {
    const JOIN_KIND_INIT = 0;
    const JOIN_EXACT_TOKENS = 1;
    const JOIN_EXACT_BPT = 2;
    const JOIN_REWARD = 4;

    opts.from ??= this.ctx.signers.holders[0];
    opts.init ??= false;
    opts.reward ??= false;

    let token0, token1, amount0, amount1;

    await this.ctx.sERC20.approve({ spender: this.ctx.contracts.bVault });

    if (this.sERC20IsToken0) {
      token0 = this.ctx.sERC20.address;
      token1 = ethers.constants.AddressZero;
      amount0 = this.ctx.params.pool.pooled.sERC20;
      amount1 = this.ctx.params.pool.pooled.ETH;
    } else {
      token0 = ethers.constants.AddressZero;
      token1 = this.ctx.sERC20.address;
      amount0 = this.ctx.params.pool.pooled.ETH;
      amount1 = this.ctx.params.pool.pooled.sERC20;
    }

    if (opts.init) {
      opts.joinKind = JOIN_KIND_INIT;
    } else if (opts.reward) {
      opts.joinKind = JOIN_REWARD;
    } else {
      opts.joinKind = JOIN_EXACT_TOKENS;
    }

    const joinPoolRequest = {
      assets: [token0, token1],
      maxAmountsIn: [amount0, amount1],
      userData: ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]"], [opts.joinKind, [amount0, amount1]]),
      fromInternalBalance: false,
    };

    this.ctx.data.tx = await this.ctx.contracts.bVault
      .connect(opts.from)
      .joinPool(this.ctx.data.poolId, opts.from.address, opts.from.address, joinPoolRequest, {
        value: this.ctx.params.pool.pooled.ETH,
      });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async latestSpotPrice(opts = {}) {
    opts.ETH ??= false;
    const DECIMALS = ethers.utils.parseEther("1");
    if (opts.ETH) {
      if (this.sERC20IsToken0) return DECIMALS.mul(DECIMALS).div(await this.getLatest(0));
      else return await this.getLatest(0);
    } else {
      if (this.sERC20IsToken0) return await this.getLatest(0);
      else return DECIMALS.mul(DECIMALS).div(await this.getLatest(0));
    }
  }

  async pairPrice(opts = {}) {
    opts.sERC20 ??= false;

    const BASE = new Decimal(10).pow(new Decimal(18));
    const { balances } = await this.ctx.contracts.bVault.getPoolTokens(this.ctx.data.poolId);
    const weights = await this.getNormalizedWeights();

    const numerator = this._decimal(balances[0]).div(this._decimal(weights[0]).div(BASE));
    const denominator = this._decimal(balances[1]).div(this._decimal(weights[1]).div(BASE));

    const price = numerator.mul(BASE).div(denominator);

    if (opts.sERC20) {
      if (this.sERC20IsToken0) return this._bn(price);
      else return this._bn(BASE.mul(BASE).div(price));
    }

    return this._bn(price);
  }

  async BTPPrice(opts = {}) {
    opts.sERC20 ??= false;

    const BASE = new Decimal(10).pow(new Decimal(18));
    const { balances } = await this.ctx.contracts.bVault.getPoolTokens(this.ctx.data.poolId);
    const weights = await this.getNormalizedWeights();
    const totalSupply = await this.totalSupply();

    if (opts.sERC20) {
      if (this.sERC20IsToken0) {
        return this._bn(this._decimal(balances[0]).mul(BASE).div(this._decimal(weights[0]).div(BASE)).div(this._decimal(totalSupply)));
      } else {
        return this._bn(this._decimal(balances[1]).mul(BASE).div(this._decimal(weights[1]).div(BASE)).div(this._decimal(totalSupply)));
      }
    } else {
      return this._bn(this._decimal(balances[0]).mul(BASE).div(this._decimal(weights[0]).div(BASE)).div(this._decimal(totalSupply)));
    }
  }

  async expectedWeights(pct) {
    const ONE = this._decimal(this.ctx.constants.pool.ONE);

    const cap = this._decimal(await this.ctx.sERC20.cap());
    const supply = this._decimal(await this.ctx.sERC20.totalSupply());

    const delta = this._decimal(this.ctx.params.pool.sMaxNormalizedWeight.sub(this.ctx.params.pool.sMinNormalizedWeight));
    const gamma = delta.mul(supply);

    const sWeight = this._decimal(this.ctx.params.pool.sMaxNormalizedWeight).sub(gamma.div(cap));
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

module.exports = Pool;
