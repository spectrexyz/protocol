const _sMinter_ = require('@spectrexyz/protocol-bootstrapping-pool/artifacts/contracts/sMinter.sol/sMinter.json');
const { ethers } = require('ethers');

class sMinter {
  constructor(ctx) {
    this.ctx = ctx;
    this.artifact = _sMinter_;
    this.contract = ctx.contracts.sMinter;
  }

  static async deploy(ctx) {
    ctx.contracts.sMinter = await waffle.deployContract(ctx.signers.sMinter.admin, _sMinter_, [
      ctx.contracts.Vault.address,
      ctx.signers.sMinter.bank.address,
      ctx.signers.sMinter.splitter.address,
      ctx.params.sMinter.protocolFee,
    ]);

    ctx.sMinter = new sMinter(ctx);
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.sMinter.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).register(this.ctx.sERC20.contract.address, {
      pool: this.ctx.sBootstrappingPool.contract.address,
      poolId: ethers.constants.HashZero,
      beneficiary: this.ctx.signers.sMinter.beneficiary.address,
      initialPrice: this.ctx.params.sMinter.initialPrice,
      allocation: this.ctx.params.sMinter.allocation,
      fee: this.ctx.params.sMinter.fee,
    });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async mint(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.value ??= this.ctx.params.sMinter.value;
    opts.expected ??= ethers.BigNumber.from('0');
    opts.recipient ??= this.ctx.signers.sMinter.recipient;

    this.ctx.data.tx = await this.contract
      .connect(opts.from)
      .mint(this.ctx.sERC20.contract.address, opts.expected, opts.recipient.address, { value: opts.value });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = sMinter;
