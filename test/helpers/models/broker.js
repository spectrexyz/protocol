const { ethers } = require("ethers");
const _Broker_ = require("../../../artifacts/contracts/broker/Broker.sol/Broker.json");
const _MarketMock_ = require("../../../artifacts/contracts/mock/MarketMock.sol/MarketMock.json");

class Broker {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.broker;
    this.vault = this.contract.vault;
    this.saleOf = this.contract.saleOf;
    this.proposalFor = this.contract.proposalFor;
    this.market = this.contract.market;
    this.ADMIN_ROLE = this.contract.ADMIN_ROLE;
    this.REGISTER_ROLE = this.contract.REGISTER_ROLE;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
  }

  static async deploy(ctx, opts) {
    ctx.contracts.marketMock = await waffle.deployContract(ctx.signers.root, _MarketMock_);
    ctx.contracts.broker = await waffle.deployContract(ctx.signers.broker.admin, _Broker_, [ctx.contracts.sERC1155.address, ctx.contracts.marketMock.address]);

    ctx.broker = new Broker(ctx);

    await (
      await ctx.contracts.broker.connect(ctx.signers.broker.admin).grantRole(await ctx.contracts.broker.REGISTER_ROLE(), ctx.signers.broker.registrar.address)
    ).wait();

    await (
      await ctx.contracts.broker.connect(ctx.signers.broker.admin).grantRole(await ctx.contracts.broker.ESCAPE_ROLE(), ctx.signers.broker.escaper.address)
    ).wait();
  }

  async register(opts = {}) {
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.guardian ??= this.ctx.signers.broker.guardian;
    opts.reserve ??= this.ctx.params.broker.reserve;
    opts.multiplier ??= this.ctx.params.broker.multiplier;
    opts.timelock ??= this.ctx.params.broker.timelock;
    opts.flash ??= true;
    opts.from ??= this.ctx.signers.broker.registrar;

    // grant broker DEFAULT_ADMIN_ROLE over sERC20
    await (
      await this.ctx.contracts.sERC20.connect(this.ctx.signers.sERC20.admin).grantRole(ethers.constants.HashZero, this.ctx.contracts.broker.address)
    ).wait();

    // fake IMarket minter as in the template
    await (
      await this.ctx.contracts.sERC20
        .connect(this.ctx.signers.sERC20.admin)
        .grantRole(await this.ctx.contracts.sERC20.MINT_ROLE(), this.ctx.contracts.marketMock.address)
    ).wait();

    this.ctx.data.tx = await this.contract
      .connect(opts.from)
      .register(opts.sERC20.address, opts.guardian.address, opts.reserve, opts.multiplier, opts.timelock, opts.flash);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async buyout(opts = {}) {
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.from ??= this.ctx.signers.broker.buyer;
    opts.beneficiary ??= this.ctx.signers.broker.beneficiary;
    opts.value ??= this.ctx.params.broker.value;

    await this.ctx.sERC20.approve({
      from: opts.from,
      spender: this.ctx.broker.contract,
      amount: await this.ctx.sERC20.balanceOf(opts.from),
    });

    this.ctx.data.tx = await this.contract.connect(opts.from).buyout(opts.sERC20.address, { value: opts.value });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
    // this.ctx.data.proposalId = this.ctx.data.receipt.events.filter((event) => event.event === "CreateProposal")[0].args.proposalId;
  }

  async createProposal(opts = {}) {
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.from ??= this.ctx.signers.broker.buyer;
    opts.value ??= this.ctx.params.broker.value;
    opts.lifespan ??= this.ctx.params.broker.lifespan;

    await this.ctx.sERC20.approve({
      from: opts.from,
      spender: this.ctx.broker.contract,
      amount: await this.ctx.sERC20.balanceOf(opts.from),
    });

    this.ctx.data.tx = await this.contract.connect(opts.from).createProposal(opts.sERC20.address, opts.lifespan, { value: opts.value });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
    this.ctx.data.proposalId = this.ctx.data.receipt.events.filter((event) => event.event === "CreateProposal")[0].args.proposalId;
  }

  async acceptProposal(opts = {}) {
    opts.from ??= this.ctx.signers.broker.guardian;
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.proposalId ??= this.ctx.data.proposalId;

    this.ctx.data.tx = await this.contract.connect(opts.from).acceptProposal(opts.sERC20.address, opts.proposalId);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async rejectProposal(opts = {}) {
    opts.from ??= this.ctx.signers.broker.guardian;
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.proposalId ??= this.ctx.data.proposalId;

    this.ctx.data.tx = await this.contract.connect(opts.from).rejectProposal(opts.sERC20.address, opts.proposalId);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async cancelProposal(opts = {}) {
    opts.from ??= this.ctx.signers.broker.buyer;
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.proposalId ??= this.ctx.data.proposalId;

    this.ctx.data.tx = await this.contract.connect(opts.from).cancelProposal(opts.sERC20.address, opts.proposalId);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async enableFlashBuyout(opts = {}) {
    opts.from ??= this.ctx.signers.broker.guardian;
    opts.sERC20 ??= this.ctx.sERC20.contract;

    this.ctx.data.tx = await this.contract.connect(opts.from).enableFlashBuyout(opts.sERC20.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = Broker;
