const { createTextChangeRange } = require("typescript");
const _Issuer_ = require("../../../artifacts/contracts/issuer/Issuer.sol/Issuer.json");
const Pool = require("./pool");

class Issuer {
  constructor(ctx) {
    this.ctx = ctx;
    this.artifact = _Issuer_;
    this.contract = this.ctx.contracts.issuer;
    this.address = this.contract.address;

    this.vault = this.contract.vault;
    this.poolFactory = this.contract.poolFactory;
    this.bank = this.contract.bank;
    this.splitter = this.contract.splitter;
    this.protocolFee = this.contract.protocolFee;
    this.WETH = this.contract.WETH;
    this.issuanceOf = this.contract.issuanceOf;
    this.twapOf = this.contract.twapOf;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.hasRole = this.contract.hasRole;
    this.DEFAULT_ADMIN_ROLE = this.contract.DEFAULT_ADMIN_ROLE;
    this.REGISTER_ROLE = this.contract.REGISTER_ROLE;
  }

  static async deploy(ctx, opts = {}) {
    opts.vault ??= ctx.contracts.bVault;
    opts.poolFactory ??= ctx.contracts.poolFactory;
    opts.bank ??= ctx.signers.issuer.bank;
    opts.splitter ??= ctx.signers.issuer.splitter;
    opts.protocolFee ??= ctx.params.issuer.protocolFee;

    ctx.contracts.issuer = await waffle.deployContract(ctx.signers.issuer.admin, _Issuer_, [
      opts.vault.address,
      opts.poolFactory.address,
      opts.splitter.address,
      opts.bank.address,
      opts.protocolFee,
    ]);

    ctx.issuer = new Issuer(ctx);

    await ctx.issuer.grantRole({ role: ctx.constants.issuer.REGISTER_ROLE, account: ctx.signers.issuer.registerer });
    await ctx.sERC20.grantRole({ role: ctx.constants.sERC20.MINT_ROLE, account: ctx.issuer });
  }

  async grantRole(opts = {}) {
    opts.from ??= this.ctx.signers.issuer.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).grantRole(opts.role, opts.account.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.issuer.registerer;
    opts.sMaxNormalizedWeight ??= this.ctx.params.pool.sMaxNormalizedWeight;
    opts.sMinNormalizedWeight ??= this.ctx.params.pool.sMinNormalizedWeight;
    opts.swapFeePercentage ??= this.ctx.params.pool.swapFeePercentage;
    opts.guardian ??= this.ctx.signers.issuer.guardian;
    opts.reserve ??= this.ctx.params.issuer.reserve;
    opts.allocation ??= this.ctx.params.issuer.allocation;
    opts.fee ??= this.ctx.params.issuer.fee;
    opts.flash ??= true;

    this.ctx.data.tx = await this.contract
      .connect(opts.from)
      .register(
        this.ctx.sERC20.contract.address,
        opts.guardian.address,
        opts.sMaxNormalizedWeight,
        opts.sMinNormalizedWeight,
        opts.swapFeePercentage,
        opts.reserve,
        opts.allocation,
        opts.fee,
        opts.flash
      );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();

    const pool = this.ctx.data.receipt.events.filter((event) => event.event === "Register")[0].args.pool;
    this.ctx.pool = await Pool.at(this.ctx, pool, opts);
    this.ctx.pool.sERC20IsToken0 = ethers.BigNumber.from(this.ctx.sERC20.address).lte(ethers.BigNumber.from(this.ctx.contracts.WETH.address));
  }

  async close(opts = {}) {
    opts.from ??= this.ctx.signers.issuer.guardian;
    opts.sERC20 ??= this.ctx.sERC20;

    this.ctx.data.tx = await this.contract.connect(opts.from).close(opts.sERC20.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
  async issue(opts = {}) {
    opts.from ??= this.ctx.signers.others[0];
    opts.value ??= this.ctx.params.issuer.value;
    opts.expected ??= ethers.BigNumber.from("0");

    this.ctx.data.tx = await this.contract.connect(opts.from).issue(this.ctx.sERC20.contract.address, opts.expected, { value: opts.value });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = Issuer;
