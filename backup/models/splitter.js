const _Splitter_ = require("../../../artifacts/contracts/utils/Splitter.sol/Splitter.json");

class Splitter {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.splitter;
    this.address = this.contract.address;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.stateOf = this.contract.stateOf;
    this.shareOf = this.contract.shareOf;
    this.withdrawnBy = this.contract.withdrawnBy;
  }

  static async deploy(ctx) {
    ctx.contracts.splitter = await waffle.deployContract(ctx.signers.splitter.admin, _Splitter_);
    ctx.splitter = new Splitter(ctx);

    const tx = await ctx.contracts.splitter.grantRole(await ctx.constants.splitter.REGISTER_ROLE, ctx.signers.splitter.registrar.address);
    await tx.wait();
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.splitter.registrar;
    opts.beneficiaries ??= this.ctx.signers.splitter.beneficiaries;
    opts.shares ??= this.ctx.params.splitter.shares;

    this.ctx.data.tx = await this.contract.connect(opts.from).register(
      this.ctx.sERC20.contract.address,
      opts.beneficiaries.map((beneficiary) => beneficiary.address),
      opts.shares
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async withdraw(opts = {}) {
    opts.from ??= this.ctx.signers.splitter.beneficiaries[0];

    this.ctx.data.tx = await this.contract.withdraw(this.ctx.sERC20.contract.address, opts.from.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async withdrawBatch(opts = {}) {
    opts.from ??= this.ctx.signers.splitter.beneficiaries[0];

    this.ctx.data.tx = await this.contract.withdrawBatch([this.ctx.data.sERC201.address, this.ctx.data.sERC202.address], opts.from.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = Splitter;
