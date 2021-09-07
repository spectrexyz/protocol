const _Issuer_ = require("../../../artifacts/contracts/issuer/Issuer.sol/Issuer.json");
const { ethers } = require("ethers");

class Issuer {
  constructor(ctx) {
    this.ctx = ctx;
    this.artifact = _Issuer_;
    this.contract = ctx.contracts.issuer;
    this.vault = this.contract.vault;
    this.bank = this.contract.bank;
    this.splitter = this.contract.splitter;
    this.protocolFee = this.contract.protocolFee;
    this.pitOf = this.contract.pitOf;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.hasRole = this.contract.hasRole;
    this.DEFAULT_ADMIN_ROLE = this.contract.DEFAULT_ADMIN_ROLE;
    this.REGISTER_ROLE = this.contract.REGISTER_ROLE;
  }

  static async deploy(ctx, opts = {}) {
    opts.vault ??= ctx.contracts.bvault;
    opts.bank ??= ctx.signers.issuer.bank;
    opts.splitter ??= ctx.signers.issuer.splitter;
    opts.protocolFee ??= ctx.params.issuer.protocolFee;

    ctx.contracts.issuer = await waffle.deployContract(ctx.signers.issuer.admin, _Issuer_, [
      opts.vault.address,
      opts.bank.address,
      opts.splitter.address,
      opts.protocolFee,
    ]);

    await (
      await ctx.contracts.issuer.connect(ctx.signers.issuer.admin).grantRole(await ctx.contracts.issuer.REGISTER_ROLE(), ctx.signers.issuer.registerer.address)
    ).wait();

    ctx.issuer = new Issuer(ctx);
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.issuer.registerer;
    opts.pool ??= { address: ethers.constants.AddressZero }; //this.ctx.sBootstrappingPool.contract;
    opts.beneficiary ??= this.ctx.signers.issuer.beneficiary;
    opts.initialPrice ??= this.ctx.params.issuer.initialPrice;
    opts.allocation ??= this.ctx.params.issuer.allocation;
    opts.fee ??= this.ctx.params.issuer.fee;

    this.ctx.data.tx = await this.contract
      .connect(opts.from)
      .register(this.ctx.sERC20.contract.address, opts.pool.address, opts.beneficiary.address, opts.initialPrice, opts.allocation, opts.fee);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async mint(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.value ??= this.ctx.params.issuer.value;
    opts.expected ??= ethers.BigNumber.from("0");
    opts.recipient ??= this.ctx.signers.issuer.recipient;

    this.ctx.data.tx = await this.contract
      .connect(opts.from)
      .mint(this.ctx.sERC20.contract.address, opts.expected, opts.recipient.address, { value: opts.value });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = Issuer;
