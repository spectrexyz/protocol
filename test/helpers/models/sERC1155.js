const _sERC1155_ = require("../../../artifacts/contracts/core/sERC1155.sol/sERC1155.json");
const _ERC721Mock_ = require("../../../artifacts/contracts/test/ERC721Mock.sol/ERC721Mock.json");
const sERC20 = require("./sERC20");
// const { _throw } = require('../errors');

class sERC1155 {
  constructor(ctx) {
    this.ctx = ctx;
    this.artifact = _sERC1155_;
    this.contract = ctx.contracts.sERC1155;
    this.supportsInterface = this.contract.supportsInterface;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.sERC20Base = this.contract.sERC20Base;
    this.unavailableURI = this.contract.unavailableURI;
    this.unlockedURI = this.contract.unlockedURI;
    this.balanceOf = this.contract.balanceOf;
    this.balanceOfBatch = this.contract.balanceOfBatch;
    this.isApprovedForAll = this.contract.isApprovedForAll;
    this.uri = this.contract.uri;
    this.onERC721Received = this.contract.onERC721Received;
  }

  static async deploy(ctx) {
    ctx.contracts.sERC1155 = await waffle.deployContract(ctx.signers.sERC1155.admin, _sERC1155_, [
      ctx.contracts.sERC20Base.address,
      ctx.params.sERC1155.unavailableURI,
      ctx.params.sERC1155.unlockedURI,
    ]);

    ctx.sERC1155 = new sERC1155(ctx);
  }

  async setApprovalForAll(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.operator ??= this.ctx.signers.sERC1155.operator;
    opts.approve ??= true;

    this.ctx.data.tx = await this.contract.connect(opts.from).setApprovalForAll(opts.operator.address, opts.approve);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async safeTransferFrom(opts = {}) {
    opts.from = opts.from ? opts.from : this.ctx.signers.holders[0];
    opts.operator = opts.operator ? opts.operator : opts.from;
    opts.to = opts.to ? opts.to : this.ctx.signers.others[0];
    opts.id = opts.id ? opts.id : this.ctx.data.id;
    opts.amount = opts.amount ? opts.amount : this.ctx.params.sERC1155.amount;
    opts.data = opts.data ? opts.data : ethers.constants.HashZero;

    this.ctx.data.tx = await this.contract.connect(opts.operator).safeTransferFrom(opts.from.address, opts.to.address, opts.id, opts.amount, opts.data);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async safeBatchTransferFrom(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.operator ??= opts.from;
    opts.to ??= this.ctx.signers.others[0];
    opts.ids ??= [this.ctx.data.id1, this.ctx.data.id2];
    opts.amounts ??= [this.ctx.params.sERC1155.amount1, this.ctx.params.sERC1155.amount2];
    opts.data ??= ethers.constants.HashZero;

    this.ctx.data.tx = await this.contract.connect(opts.operator).safeBatchTransferFrom(opts.from.address, opts.to.address, opts.ids, opts.amounts, opts.data);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async spectralize(opts = {}) {
    opts.collection ??= this.ctx.contracts.sERC721;
    opts.transfer ??= false;
    opts.mock ??= false;
    opts.guardian ??= this.ctx.signers.sERC1155.guardian;

    if (opts.mock) {
      this.ctx.contracts.ERC721Mock = await waffle.deployContract(this.ctx.signers.root, _ERC721Mock_);

      this.ctx.data.tx = await this.contract.spectralize(
        this.ctx.contracts.ERC721Mock.address,
        0,
        this.ctx.params.sERC20.name,
        this.ctx.params.sERC20.symbol,
        this.ctx.params.sERC20.cap,
        this.ctx.signers.sERC20.admin.address,
        opts.guardian.address
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
          .spectralize(
            opts.collection.address,
            this.ctx.data.tokenId,
            this.ctx.params.sERC20.name,
            this.ctx.params.sERC20.symbol,
            this.ctx.params.sERC20.cap,
            this.ctx.signers.sERC20.admin.address,
            opts.guardian.address
          );
        this.ctx.data.tx2 = this.ctx.data.tx; // fix a bug where an un-waited tx overrides the current tx somewhere
        this.ctx.data.receipt = await this.ctx.data.tx.wait();
        this.ctx.data.id = await this._id();
      }
    }

    this.ctx.sERC20 = await sERC20.at(this.ctx, await this.contract.sERC20Of(this.ctx.data.id), opts);
  }

  async unlock(opts = {}) {
    opts.from ??= this.ctx.signers.sERC1155.guardian;
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
    opts.from ??= this.ctx.signers.sERC1155.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).updateUnavailableURI(uri);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async updateUnlockedURI(uri, opts = {}) {
    opts.from ??= this.ctx.signers.sERC1155.admin;

    this.ctx.data.tx = await this.contract.connect(opts.from).updateUnlockedURI(uri);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  _data(opts = {}) {
    opts.short ??= false;
    opts.derrida ??= this.ctx.constants.sERC1155.DERRIDA;

    return opts.short
      ? ethers.utils.concat([
          ethers.utils.formatBytes32String(this.ctx.params.sERC20.name),
          ethers.utils.formatBytes32String(this.ctx.params.sERC20.symbol),
          ethers.utils.defaultAbiCoder.encode(["uint256"], [this.ctx.params.sERC20.cap]),
          ethers.utils.defaultAbiCoder.encode(["address"], [this.ctx.signers.sERC20.admin.address]),
          ethers.utils.defaultAbiCoder.encode(["address"], [this.ctx.signers.sERC1155.guardian.address]),
        ])
      : ethers.utils.concat([
          ethers.utils.formatBytes32String(this.ctx.constants.name),
          ethers.utils.formatBytes32String(this.ctx.constants.symbol),
          ethers.utils.defaultAbiCoder.encode(["uint256"], [this.ctx.constants.cap]),
          ethers.utils.defaultAbiCoder.encode(["address"], [this.ctx.signers.sERC20.admin.address]),
          ethers.utils.defaultAbiCoder.encode(["address"], [this.ctx.signers.sERC1155.guardian.address]),
          ethers.utils.defaultAbiCoder.encode(["bytes32"], [opts.derrida]),
        ]);
  }

  async _id(opts = {}) {
    opts.transfer ??= false;

    if (opts.transfer)
      return (await this.ctx.contracts.sERC1155.queryFilter(this.ctx.contracts.sERC1155.filters.Spectralize())).filter(
        (event) => event.event === "Spectralize"
      )[0].args.id;
    else return this.ctx.data.receipt.events.filter((event) => event.event === "Spectralize")[0].args.id;
  }
}

module.exports = sERC1155;
