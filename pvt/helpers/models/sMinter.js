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
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.hasRole = this.contract.hasRole;
    this.ADMIN_ROLE = this.contract.ADMIN_ROLE;
    this.REGISTER_ROLE = this.contract.REGISTER_ROLE;
  }

  static async deploy(ctx, opts = {}) {
    opts.vault ??= ctx.contracts.Vault;
    opts.bank ??= ctx.signers.sMinter.bank;
    opts.splitter ??= ctx.signers.sMinter.splitter;
    opts.protocolFee ??= ctx.params.sMinter.protocolFee;

    ctx.contracts.sMinter = await waffle.deployContract(ctx.signers.sMinter.admin, _sMinter_, [
      opts.vault.address,
      opts.bank.address,
      opts.splitter.address,
      opts.protocolFee,
    ]);

    await (
      await ctx.contracts.sMinter
        .connect(ctx.signers.sMinter.admin)
        .grantRole(await ctx.contracts.sMinter.REGISTER_ROLE(), ctx.signers.sMinter.registerer.address)
    ).wait();

    ctx.sMinter = new sMinter(ctx);
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.sMinter.registerer;
    opts.pool ??= this.ctx.sBootstrappingPool.contract;
    opts.beneficiary ??= this.ctx.signers.sMinter.beneficiary;
    opts.initialPrice ??= this.ctx.params.sMinter.initialPrice;
    opts.allocation ??= this.ctx.params.sMinter.allocation;
    opts.fee ??= this.ctx.params.sMinter.fee;

    this.ctx.data.tx = await this.contract
      .connect(opts.from)
      .register(this.ctx.sERC20.contract.address, opts.pool.address, opts.beneficiary.address, opts.initialPrice, opts.allocation, opts.fee);
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
