const _Vault_ = require("../../../artifacts/contracts/vault/Vault.sol/Vault.json");
const sERC20 = require("./sERC20");

class Vault {
  constructor(ctx) {
    this.ctx = ctx;
    this.artifact = _Vault_;
    this.contract = ctx.contracts.vault;
    this.address = this.contract.address;
    this.supportsInterface = this.contract.supportsInterface;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.sERC20Base = this.contract.sERC20Base;
    this.uri = this.contract.uri;
    this.unavailableURI = this.contract.unavailableURI;
    this.unlockedURI = this.contract.unlockedURI;
    this.balanceOf = this.contract.balanceOf;
    this.balanceOfBatch = this.contract.balanceOfBatch;
    this.isApprovedForAll = this.contract.isApprovedForAll;
    this.isLocked = this.contract.isLocked;
    this.tokenTypeOf = this.contract.tokenTypeOf;
    this.onERC721Received = this.contract.onERC721Received;
  }

  static async deploy(ctx) {
    ctx.contracts.vault = await waffle.deployContract(ctx.signers.vault.admin, _Vault_, [
      ctx.contracts.sERC20Base.address,
      ctx.params.vault.unavailableURI,
      ctx.params.vault.unlockedURI,
    ]);

    ctx.vault = new Vault(ctx);
  }

  async setApprovalForAll(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.operator ??= this.ctx.signers.vault.operator;
    opts.status ??= true;

    this.ctx.data.tx = await this.contract.connect(opts.from).setApprovalForAll(opts.operator.address, opts.status);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async safeTransferFrom(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.operator ??= opts.from;
    opts.to ??= this.ctx.signers.others[0];
    opts.id ??= this.ctx.data.id;
    opts.amount ??= this.ctx.params.vault.amount;
    opts.data ??= ethers.constants.HashZero;

    this.ctx.data.tx = await this.contract.connect(opts.operator).safeTransferFrom(opts.from.address, opts.to.address, opts.id, opts.amount, opts.data);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async safeBatchTransferFrom(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.operator ??= opts.from;
    opts.to ??= this.ctx.signers.others[0];
    opts.ids ??= [this.ctx.data.id1, this.ctx.data.id2];
    opts.amounts ??= [this.ctx.params.vault.amount1, this.ctx.params.vault.amount2];
    opts.data ??= ethers.constants.HashZero;

    this.ctx.data.tx = await this.contract.connect(opts.operator).safeBatchTransferFrom(opts.from.address, opts.to.address, opts.ids, opts.amounts, opts.data);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async fractionalize(opts = {}) {
    opts.collection ??= this.ctx.contracts.sERC721;
    opts.transfer ??= false;
    opts.mock ??= false;
    opts.broker ??= this.ctx.signers.vault.broker;

    if (opts.mock) {
      this.ctx.data.tx = await this.contract.fractionalize(
        this.ctx.contracts.ERC721Mock.address,
        0,
        this.ctx.params.sERC20.name,
        this.ctx.params.sERC20.symbol,
        this.ctx.params.sERC20.cap,
        this.ctx.signers.sERC20.admin.address,
        opts.broker.address
      );
      this.ctx.data.receipt = await this.ctx.data.tx.wait();
      this.ctx.data.id = await this._id();
    } else {
      if (opts.transfer) {
        const data = this._data(opts);
        await this.ctx.sERC721.safeTransferFrom({ data });
        this.ctx.data.id = await this._id({ transfer: true });
      } else {
        this.ctx.data.tx = await this.contract
          .connect(this.ctx.signers.root)
          .fractionalize(
            opts.collection.address,
            this.ctx.data.tokenId,
            this.ctx.params.sERC20.name,
            this.ctx.params.sERC20.symbol,
            this.ctx.params.sERC20.cap,
            this.ctx.signers.sERC20.admin.address,
            opts.broker.address
          );
        this.ctx.data.tx2 = this.ctx.data.tx; // fix a bug where an un-waited tx overrides the current tx somewhere
        this.ctx.data.receipt = await this.ctx.data.tx.wait();
        this.ctx.data.id = await this._id();
      }
    }
    this.ctx.sERC20 = await sERC20.at(this.ctx, await this.contract.sERC20Of(this.ctx.data.id), opts);
  }

  async unlock(opts = {}) {
    opts.from ??= this.ctx.signers.vault.broker;
    opts.byAddress ??= false;

    if (opts.byAddress) {
      this.ctx.data.tx = await this.contract
        .connect(opts.from)
        ["unlock(address,address,bytes)"](this.ctx.contracts.sERC20.address, this.ctx.signers.sERC721.owners[1].address, ethers.constants.HashZero);
    } else {
      this.ctx.data.tx = await this.contract
        .connect(opts.from)
        ["unlock(uint256,address,bytes)"](this.ctx.data.id, this.ctx.signers.sERC721.owners[1].address, ethers.constants.HashZero);
    }

    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async updateUnavailableURI(uri, opts = {}) {
    opts.from ??= this.ctx.signers.vault.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).updateUnavailableURI(uri);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async updateUnlockedURI(uri, opts = {}) {
    opts.from ??= this.ctx.signers.vault.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).updateUnlockedURI(uri);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  _data(opts = {}) {
    opts.short ??= false;
    opts.derrida ??= this.ctx.constants.vault.DERRIDA;

    return opts.short
      ? ethers.utils.concat([
          ethers.utils.formatBytes32String(this.ctx.params.sERC20.name),
          ethers.utils.formatBytes32String(this.ctx.params.sERC20.symbol),
          ethers.utils.defaultAbiCoder.encode(["uint256"], [this.ctx.params.sERC20.cap]),
          ethers.utils.defaultAbiCoder.encode(["address"], [this.ctx.signers.sERC20.admin.address]),
          ethers.utils.defaultAbiCoder.encode(["address"], [this.ctx.signers.vault.broker.address]),
        ])
      : ethers.utils.concat([
          ethers.utils.formatBytes32String(this.ctx.params.sERC20.name),
          ethers.utils.formatBytes32String(this.ctx.params.sERC20.symbol),
          ethers.utils.defaultAbiCoder.encode(["uint256"], [this.ctx.params.sERC20.cap]),
          ethers.utils.defaultAbiCoder.encode(["address"], [this.ctx.signers.sERC20.admin.address]),
          ethers.utils.defaultAbiCoder.encode(["address"], [this.ctx.signers.vault.broker.address]),
          ethers.utils.defaultAbiCoder.encode(["bytes32"], [opts.derrida]),
        ]);
  }

  async _id(opts = {}) {
    opts.transfer ??= false;

    if (opts.transfer)
      return (await this.ctx.contracts.vault.queryFilter(this.ctx.contracts.vault.filters.Fractionalize())).filter(
        (event) => event.event === "Fractionalize"
      )[0].args.id;
    else return this.ctx.data.receipt.events.filter((event) => event.event === "Fractionalize")[0].args.id;
  }
}

module.exports = Vault;
