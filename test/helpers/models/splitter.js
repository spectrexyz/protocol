const _Splitter_ = require("../../../artifacts/contracts/utils/Splitter.sol/Splitter.json");

class Splitter {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.splitter;
    this.address = this.contract.address;
    this.bank = this.contract.bank;
    this.fee = this.contract.fee;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.stateOf = this.contract.stateOf;
    this.shareOf = this.contract.shareOf;
    this.withdrawnBy = this.contract.withdrawnBy;
  }

  static async deploy(ctx, opts = {}) {
    opts.bank ??= ctx.signers.splitter.bank;
    opts.fee ??= ctx.params.splitter.fee;

    ctx.contracts.splitter = await waffle.deployContract(ctx.signers.splitter.admin, _Splitter_, [opts.bank.address, opts.fee]);
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

  async setBank(opts = {}) {
    opts.from ??= this.ctx.signers.splitter.admin;
    opts.bank ??= this.ctx.signers.splitter.bank;

    this.ctx.data.tx = await this.contract.connect(opts.from).setBank(opts.bank.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async setFee(opts = {}) {
    opts.from ??= this.ctx.signers.splitter.admin;
    opts.fee ??= this.ctx.params.splitter.fee;

    this.ctx.data.tx = await this.contract.connect(opts.from).setFee(opts.fee);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  normalizedShares() {
    const total = this.ctx.params.splitter.shares[0]
      .add(this.ctx.params.splitter.shares[1])
      .add(this.ctx.params.splitter.shares[2])
      .add(this.ctx.params.splitter.fee);
    const share0 = this.ctx.params.splitter.shares[0].mul(this.ctx.constants.splitter.HUNDRED).div(total);
    const share1 = this.ctx.params.splitter.shares[1].mul(this.ctx.constants.splitter.HUNDRED).div(total);
    const share2 = this.ctx.params.splitter.shares[2].mul(this.ctx.constants.splitter.HUNDRED).div(total);
    const shareBank = this.ctx.constants.splitter.HUNDRED.sub(share0.add(share1).add(share2));

    return [share0, share1, share2, shareBank];
  }
}

module.exports = Splitter;
