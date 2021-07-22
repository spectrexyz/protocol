const _sMinter_ = require('@spectrexyz/protocol-bootstrapping-pool/artifacts/contracts/sMinter.sol/sMinter.json');
const { ethers } = require('ethers');

class sMinter {
  constructor(ctx) {
    this.ctx = ctx;
    this.artifact = _sMinter_;
    this.contract = ctx.contracts.sMinter;
    this.vault = this.contract.vault;
    this.bank = this.contract.bank;
    this.splitter = this.contract.splitter;
    this.protocolFee = this.contract.protocolFee;
    this.pitOf = this.contract.pitOf;
  }

  static async deploy(ctx, opts = {}) {
    opts.vault ??= ctx.contracts.Vault;
    opts.bank ??= ctx.signers.sMinter.bank;
    opts.splitter ??= ctx.signers.sMinter.splitter;

    ctx.contracts.sMinter = await waffle.deployContract(ctx.signers.sMinter.admin, _sMinter_, [
      opts.vault.address,
      opts.bank.address,
      opts.splitter.address,
      ctx.params.sMinter.protocolFee,
    ]);

    ctx.sMinter = new sMinter(ctx);
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.sMinter.admin;
    opts.pool ??= this.ctx.sBootstrappingPool.contract;
    opts.beneficiary ??= this.ctx.signers.sMinter.beneficiary;
    opts.initialPrice ??= this.ctx.params.sMinter.initialPrice;

    this.ctx.data.tx = await this.contract.connect(opts.from).register(this.ctx.sERC20.contract.address, {
      pool: opts.pool.address,
      poolId: ethers.constants.HashZero,
      beneficiary: opts.beneficiary.address,
      initialPrice: opts.initialPrice,
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
