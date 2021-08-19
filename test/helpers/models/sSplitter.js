const _sSplitter_ = require("../../../artifacts/contracts/utils/sSplitter.sol/sSplitter.json");

class sSplitter {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.sSplitter;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.DEFAULT_ADMIN_ROLE = this.contract.DEFAULT_ADMIN_ROLE;
    this.REGISTRAR_ROLE = this.contract.REGISTRAR_ROLE;
    this.splitOf = this.contract.splitOf;
    this.isRegistered = this.contract.isRegistered;
    this.withdrawnBy = this.contract.withdrawnBy;
  }

  static async deploy(ctx) {
    ctx.contracts.sSplitter = await waffle.deployContract(
      ctx.signers.sSplitter.admin,
      _sSplitter_,
      [ctx.signers.sSplitter.registrar.address]
    );

    ctx.sSplitter = new sSplitter(ctx);
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.sSplitter.registrar;
    opts.beneficiaries ??= this.ctx.signers.sSplitter.beneficiaries;
    opts.shares ??= this.ctx.params.sSplitter.shares;

    this.ctx.data.tx = await this.contract.connect(opts.from).register(
      this.ctx.sERC20.contract.address,
      opts.beneficiaries.map((beneficiary) => beneficiary.address),
      opts.shares
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async withdraw(opts = {}) {
    opts.from ??= this.ctx.signers.sSplitter.beneficiaries[0];

    this.ctx.data.tx = await this.contract.withdraw(
      this.ctx.sERC20.contract.address,
      opts.from.address
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async withdrawBatch(opts = {}) {
    opts.from ??= this.ctx.signers.sSplitter.beneficiaries[0];

    this.ctx.data.tx = await this.contract.withdrawBatch(
      [this.ctx.data.sERC201.address, this.ctx.data.sERC202.address],
      opts.from.address
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = sSplitter;
