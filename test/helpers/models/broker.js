const _Broker_ = require("../../../artifacts/contracts/broker/Broker.sol/Broker.json");
const _IssuerMock_ = require("../../../artifacts/contracts/mock/IssuerMock.sol/IssuerMock.json");

class Broker {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.broker;
    this.address = this.contract.address;
    this.vault = this.contract.vault;
    this.saleOf = this.contract.saleOf;
    this.proposalFor = this.contract.proposalFor;
    this.issuer = this.contract.issuer;
    this.bank = this.contract.bank;
    this.protocolFee = this.contract.protocolFee;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.priceOfFor = this.contract.priceOfFor;
    this.twapOf = ctx.contracts.issuerMock.twapOf;
  }

  static async deploy(ctx, opts = {}) {
    ctx.contracts.issuerMock = await waffle.deployContract(ctx.signers.root, _IssuerMock_);

    opts.vault ??= ctx.vault;
    opts.issuer ??= ctx.contracts.issuerMock;
    opts.bank ??= ctx.signers.broker.bank;
    opts.protocolFee ??= ctx.params.broker.protocolFee;

    ctx.contracts.broker = await waffle.deployContract(ctx.signers.broker.admin, _Broker_, [
      opts.vault.address,
      opts.issuer.address,
      opts.bank.address,
      opts.protocolFee,
    ]);

    ctx.broker = new Broker(ctx);

    await (
      await ctx.contracts.broker.connect(ctx.signers.broker.admin).grantRole(await ctx.constants.broker.REGISTER_ROLE, ctx.signers.broker.registrar.address)
    ).wait();

    await (
      await ctx.contracts.broker.connect(ctx.signers.broker.admin).grantRole(await ctx.constants.broker.ESCAPE_ROLE, ctx.signers.broker.escaper.address)
    ).wait();
  }

  async register(opts = {}) {
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.guardian ??= this.ctx.signers.broker.guardian;
    opts.reserve ??= this.ctx.params.broker.reserve;
    opts.multiplier ??= this.ctx.params.broker.multiplier;
    opts.timelock ??= this.ctx.params.broker.timelock;
    opts.flash ??= true;
    opts.escape ??= true;
    opts.from ??= this.ctx.signers.broker.registrar;
    opts.cap ??= false;

    await (
      await this.ctx.contracts.sERC20.connect(this.ctx.signers.sERC20.admin).grantRole(this.ctx.constants.sERC20.MINT_ROLE, this.ctx.contracts.broker.address)
    ).wait();

    // fake IMarket minter as in the template
    await (
      await this.ctx.contracts.sERC20
        .connect(this.ctx.signers.sERC20.admin)
        .grantRole(await this.ctx.contracts.sERC20.MINT_ROLE(), this.ctx.contracts.issuerMock.address)
    ).wait();

    this.ctx.data.tx = await this.contract
      .connect(opts.from)
      .register(opts.sERC20.address, opts.guardian.address, opts.reserve, opts.multiplier, opts.timelock, opts.flash, opts.escape, opts.cap);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async buyout(opts = {}) {
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.from ??= this.ctx.signers.broker.buyer;
    opts.beneficiary ??= this.ctx.signers.broker.beneficiary;
    opts.cap ??= false;
    opts.value ??= opts.cap ? this.ctx.params.broker.capValue : this.ctx.params.broker.value;

    await this.ctx.sERC20.approve({
      from: opts.from,
      spender: this.ctx.broker.contract,
      amount: await this.ctx.sERC20.balanceOf(opts.from.address),
    });

    this.ctx.data.tx = await this.contract.connect(opts.from).buyout(opts.sERC20.address, { value: opts.value });
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async createProposal(opts = {}) {
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.from ??= this.ctx.signers.broker.buyer;
    opts.value ??= this.ctx.params.broker.value;
    opts.lifespan ??= this.ctx.params.broker.lifespan;

    await this.ctx.sERC20.approve({
      from: opts.from,
      spender: this.ctx.broker.contract,
      amount: await this.ctx.sERC20.balanceOf(opts.from.address),
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

  async withdrawProposal(opts = {}) {
    opts.from ??= this.ctx.signers.broker.buyer;
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.proposalId ??= this.ctx.data.proposalId;

    this.ctx.data.tx = await this.contract.connect(opts.from).withdrawProposal(opts.sERC20.address, opts.proposalId);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async enableFlashBuyout(opts = {}) {
    opts.from ??= this.ctx.signers.broker.guardian;
    opts.sERC20 ??= this.ctx.sERC20.contract;

    this.ctx.data.tx = await this.contract.connect(opts.from).enableFlashBuyout(opts.sERC20.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async enableEscape(opts = {}) {
    opts.from ??= this.ctx.signers.broker.guardian;
    opts.sERC20 ??= this.ctx.sERC20.contract;

    this.ctx.data.tx = await this.contract.connect(opts.from).enableEscape(opts.sERC20.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async disableEscape(opts = {}) {
    opts.from ??= this.ctx.signers.broker.guardian;
    opts.sERC20 ??= this.ctx.sERC20.contract;

    this.ctx.data.tx = await this.contract.connect(opts.from).disableEscape(opts.sERC20.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async setReserve(opts = {}) {
    opts.from ??= this.ctx.signers.broker.guardian;
    opts.sERC20 ??= this.ctx.sERC20.contract;
    opts.reserve ??= ethers.BigNumber.from("1");

    this.ctx.data.tx = await this.contract.connect(opts.from).setReserve(opts.sERC20.address, opts.reserve);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async claim(opts = {}) {
    opts.from ??= this.ctx.signers.others[0];
    opts.sERC20 ??= this.ctx.sERC20.contract.address;

    await this.ctx.sERC20.approve({
      from: opts.from,
      spender: this.ctx.broker.contract,
      amount: await this.ctx.sERC20.balanceOf(opts.from.address),
    });

    this.ctx.data.gasSpent = this.ctx.data.receipt.gasUsed.mul(this.ctx.data.tx.gasPrice);

    this.ctx.data.tx = await this.contract.connect(opts.from).claim(opts.sERC20);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();

    this.ctx.data.gasSpent = this.ctx.data.gasSpent.add(this.ctx.data.receipt.gasUsed.mul(this.ctx.data.tx.gasPrice));
  }

  async escape(opts = {}) {
    opts.from ??= this.ctx.signers.broker.escaper;
    opts.sERC20s ??= [this.ctx.data.sERC20.contract.address, this.ctx.sERC20.contract.address];
    opts.beneficiaries ??= [this.ctx.signers.broker.beneficiaries[0].address, this.ctx.signers.broker.beneficiaries[1].address];
    opts.datas ??= [ethers.constants.HashZero, ethers.constants.HashZero];

    this.ctx.data.tx = await this.contract.connect(opts.from)._escape_(opts.sERC20s, opts.beneficiaries, opts.datas);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = Broker;
