const _sERC20Splitter_ = require('@spectrexyz/protocol-infrastructure/artifacts/contracts/sERC20Splitter.sol/sERC20Splitter.json');

class sERC20Splitter {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.sERC20Splitter;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.DEFAULT_ADMIN_ROLE = this.contract.DEFAULT_ADMIN_ROLE;
    this.REGISTRAR_ROLE = this.contract.REGISTRAR_ROLE;
    this.splitOf = this.contract.splitOf;
    this.isRegistered = this.contract.isRegistered;
    this.withdrawnBy = this.contract.withdrawnBy;
  }

  static async deploy(ctx) {
    ctx.contracts.sERC20Splitter = await waffle.deployContract(ctx.signers.sERC20Splitter.admin, _sERC20Splitter_, [
      ctx.signers.sERC20Splitter.registrar.address,
    ]);

    ctx.sERC20Splitter = new sERC20Splitter(ctx);
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.sERC20Splitter.registrar;
    opts.beneficiaries ??= this.ctx.signers.sERC20Splitter.beneficiaries;
    opts.shares ??= this.ctx.params.sERC20Splitter.shares;

    this.ctx.data.tx = await this.contract.connect(opts.from).register(
      this.ctx.sERC20.contract.address,
      opts.beneficiaries.map((beneficiary) => beneficiary.address),
      opts.shares
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async withdraw(opts = {}) {
    opts.from ??= this.ctx.signers.sERC20Splitter.beneficiaries[0];

    this.ctx.data.tx = await this.contract.withdraw(this.ctx.sERC20.contract.address, opts.from.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async withdrawBatch(opts = {}) {
    opts.from ??= this.ctx.signers.sERC20Splitter.beneficiaries[0];

    this.ctx.data.tx = await this.contract.withdrawBatch([this.ctx.data.sERC201.address, this.ctx.data.sERC202.address], opts.from.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = sERC20Splitter;
