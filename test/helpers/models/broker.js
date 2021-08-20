const { ethers } = require("ethers");
const _Broker_ = require("../../../artifacts/contracts/broker/FlashBroker.sol/FlashBroker.json");

class Broker {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.broker;
    this.sERC1155 = this.contract.sERC1155;
    this.saleOf = this.contract.saleOf;
  }

  static async deploy(ctx, opts) {
    ctx.contracts.broker = await waffle.deployContract(ctx.signers.root, _Broker_, [ctx.contracts.sERC1155.address]);

    ctx.broker = new Broker(ctx);
  }

  async register(opts = {}) {
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.guardian ??= this.ctx.signers.broker.guardian;
    opts.minimum ??= this.ctx.params.broker.minimum;
    opts.pool ??= this.ctx.signers.others[1];
    opts.multiplier ??= this.ctx.params.broker.multiplier;
    opts.timelock ??= this.ctx.params.broker.timelock;
    opts.flash ??= true;

    this.ctx.data.tx = await this.contract.register(
      opts.sERC20.address,
      opts.guardian.address,
      opts.minimum,
      opts.pool.address,
      opts.multiplier,
      opts.timelock,
      opts.flash
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async buyout(opts = {}) {
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.from ??= this.ctx.signers.broker.buyer;
    opts.beneficiary ??= this.ctx.signers.broker.beneficiary;
    opts.value ??= this.ctx.params.broker.value;

    this.ctx.data.tx = await this.contract.connect(opts.from).buyout(opts.sERC20.address, opts.beneficiary.address, { value: opts.value });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = Broker;