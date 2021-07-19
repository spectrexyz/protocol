const _sMinter_ = require('@spectrexyz/protocol-bootstrapping-pool/artifacts/contracts/sMinter.sol/sMinter.json');

class sMinter {
  constructor(ctx) {
    this.ctx = ctx;
    this.artifact = _sMinter_;
    this.contract = ctx.contracts.sMinter;
  }

  static async deploy(ctx) {
    ctx.contracts.sMinter = await waffle.deployContract(ctx.signers.sMinter.admin, _sMinter_);

    ctx.sMinter = new sMinter(ctx);
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.sMinter.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).register(this.ctx.sERC20.contract.address, this.ctx.sBootstrappingPool.contract.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async mint(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];

    this.ctx.data.tx = await this.contract.connect(opts.from).mint(this.ctx.sERC20.contract.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = sMinter;
