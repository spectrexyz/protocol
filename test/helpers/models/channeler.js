const _Channeler_ = require("../../../artifacts/contracts/channeler/Channeler.sol/Channeler.json");
const sERC20 = require("./sERC20");

class Channeler {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.channeler;
    this.address = this.contract.address;
    this.vault = this.contract.vault;
    this.issuer = this.contract.issuer;
    this.broker = this.contract.broker;
    this.splitter = this.contract.splitter;
    this.hasRole = this.contract.hasRole;
    this.paused = this.contract.paused;
  }

  static async deploy(ctx, opts = {}) {
    opts.sERC721 ??= ctx.sERC721;
    opts.vault ??= ctx.vault;
    opts.issuer ??= ctx.issuer;
    opts.broker ??= ctx.broker;
    opts.splitter ??= ctx.splitter;

    ctx.contracts.channeler = await waffle.deployContract(ctx.signers.channeler.admin, _Channeler_, [
      opts.sERC721.address,
      opts.vault.address,
      opts.issuer.address,
      opts.broker.address,
      opts.splitter.address,
    ]);

    ctx.channeler = new Channeler(ctx);

    await (await ctx.contracts.sERC721.connect(ctx.signers.sERC721.admin).grantRole(await ctx.constants.sERC721.MINT_ROLE, ctx.channeler.address)).wait();
    await (await ctx.contracts.issuer.connect(ctx.signers.issuer.admin).grantRole(await ctx.constants.issuer.REGISTER_ROLE, ctx.channeler.address)).wait();
    await (await ctx.contracts.broker.connect(ctx.signers.broker.admin).grantRole(await ctx.constants.broker.REGISTER_ROLE, ctx.channeler.address)).wait();
    await (await ctx.contracts.issuer.connect(ctx.signers.issuer.admin).grantRole(await ctx.constants.issuer.CLOSE_ROLE, ctx.broker.address)).wait();
    await (
      await ctx.contracts.splitter.connect(ctx.signers.splitter.admin).grantRole(await ctx.constants.splitter.REGISTER_ROLE, ctx.channeler.address)
    ).wait();
  }

  async mintAndFractionalize(opts = {}) {
    opts.guardian ??= this.ctx.signers.channeler.guardian;
    opts.tokenURI ??= this.ctx.params.channeler.tokenURI;
    opts.name ??= this.ctx.params.sERC20.name;
    opts.symbol ??= this.ctx.params.sERC20.symbol;
    opts.cap ??= this.ctx.params.sERC20.cap;
    opts.buyoutReserve ??= this.ctx.params.broker.reserve;
    opts.multiplier ??= this.ctx.params.broker.multiplier;
    opts.timelock ??= this.ctx.params.broker.timelock;
    opts.sMaxNormalizedWeight ??= this.ctx.params.pool.sMaxNormalizedWeight;
    opts.sMinNormalizedWeight ??= this.ctx.params.pool.sMinNormalizedWeight;
    opts.beneficiaries ??= this.ctx.signers.splitter.beneficiaries;
    opts.shares ??= this.ctx.params.splitter.shares;
    opts.swapFeePercentage ??= this.ctx.params.pool.swapFeePercentage;
    opts.issuanceReserve ??= this.ctx.params.issuer.reserve;
    opts.fee ??= this.ctx.params.issuer.fee;
    opts.buyoutFlash ??= false;
    opts.issuanceFlash ??= false;
    opts.from ??= this.ctx.signers.sERC721.owners[0];

    await (await this.ctx.sERC721.contract.connect(opts.from).setApprovalForAll(this.ctx.vault.address, true)).wait();
    this.ctx.data.tx = await this.contract.connect(opts.from).mintAndFractionalize(opts.tokenURI, {
      guardian: opts.guardian.address,
      name: opts.name,
      symbol: opts.symbol,
      cap: opts.cap,
      buyoutReserve: opts.buyoutReserve,
      multiplier: opts.multiplier,
      timelock: opts.timelock,
      sMaxNormalizedWeight: opts.sMaxNormalizedWeight,
      sMinNormalizedWeight: opts.sMinNormalizedWeight,
      beneficiaries: opts.beneficiaries.map((b) => b.address),
      shares: opts.shares,
      swapFeePercentage: opts.swapFeePercentage,
      issuanceReserve: opts.issuanceReserve,
      fee: opts.fee,
      buyoutFlash: opts.buyoutFlash,
      issuanceFlash: opts.issuanceFlash,
    });

    this.ctx.data.receipt = await this.ctx.data.tx.wait();
    this.ctx.data.id = await this.ctx.vault._id({ transfer: true });
    this.ctx.data.events = (await this.ctx.contracts.sERC721.queryFilter(this.ctx.contracts.sERC721.filters.Transfer())).filter(
      (event) => event.event === "Transfer"
    );
    this.ctx.data.tokenId = this.ctx.data.events[this.ctx.data.events.length - 1].args.tokenId;
    this.ctx.sERC20 = await sERC20.at(this.ctx, await this.ctx.vault.contract.sERC20Of(this.ctx.data.id), { permissions: false });
  }

  async fractionalize(opts = {}) {
    opts.guardian ??= this.ctx.signers.channeler.guardian;
    opts.collection ??= this.ctx.sERC721;
    opts.tokenId ??= this.ctx.data.tokenId;
    opts.name ??= this.ctx.params.sERC20.name;
    opts.symbol ??= this.ctx.params.sERC20.symbol;
    opts.cap ??= this.ctx.params.sERC20.cap;
    opts.buyoutReserve ??= this.ctx.params.broker.reserve;
    opts.multiplier ??= this.ctx.params.broker.multiplier;
    opts.timelock ??= this.ctx.params.broker.timelock;
    opts.sMaxNormalizedWeight ??= this.ctx.params.pool.sMaxNormalizedWeight;
    opts.sMinNormalizedWeight ??= this.ctx.params.pool.sMinNormalizedWeight;
    opts.beneficiaries ??= this.ctx.signers.splitter.beneficiaries;
    opts.shares ??= this.ctx.params.splitter.shares;
    opts.swapFeePercentage ??= this.ctx.params.pool.swapFeePercentage;
    opts.issuanceReserve ??= this.ctx.params.issuer.reserve;
    opts.fee ??= this.ctx.params.issuer.fee;
    opts.buyoutFlash ??= false;
    opts.issuanceFlash ??= false;

    await this.ctx.sERC721.approve();
    this.ctx.data.tx = await this.contract.fractionalize(opts.collection.address, opts.tokenId, {
      guardian: opts.guardian.address,
      name: opts.name,
      symbol: opts.symbol,
      cap: opts.cap,
      buyoutReserve: opts.buyoutReserve,
      multiplier: opts.multiplier,
      timelock: opts.timelock,
      sMaxNormalizedWeight: opts.sMaxNormalizedWeight,
      sMinNormalizedWeight: opts.sMinNormalizedWeight,
      beneficiaries: opts.beneficiaries.map((b) => b.address),
      shares: opts.shares,
      swapFeePercentage: opts.swapFeePercentage,
      issuanceReserve: opts.issuanceReserve,
      fee: opts.fee,
      buyoutFlash: opts.buyoutFlash,
      issuanceFlash: opts.issuanceFlash,
    });

    this.ctx.data.receipt = await this.ctx.data.tx.wait();
    this.ctx.data.id = await this.ctx.vault._id({ transfer: true });
    this.ctx.sERC20 = await sERC20.at(this.ctx, await this.ctx.vault.contract.sERC20Of(this.ctx.data.id), { permissions: false });
  }

  async pause(opts = {}) {
    opts.from ??= this.ctx.signers.channeler.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).pause();
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async unpause(opts = {}) {
    opts.from ??= this.ctx.signers.channeler.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).unpause();
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = Channeler;
