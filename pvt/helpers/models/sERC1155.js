const _sERC1155_ = require('@spectrexyz/protocol-core/artifacts/contracts/sERC1155.sol/sERC1155.json');
const _ERC721Mock_ = require('@spectrexyz/protocol-core/artifacts/contracts/test/ERC721Mock.sol/ERC721Mock.json');
const sERC20 = require('./sERC20');
// const { _throw } = require('../errors');

class sERC1155 {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.sERC1155;
    this.supportsInterface = this.contract.supportsInterface;
    this.hasRole = this.contract.hasRole;
    this.getRoleAdmin = this.contract.getRoleAdmin;
    this.sERC20Base = this.contract.sERC20Base;
    this.unavaibleURI = this.contract.unavaibleURI;
    this.unlockedURI = this.contract.unlockedURI;
    this.balanceOf = this.contract.balanceOf;
  }

  static async deploy(ctx) {
    ctx.contracts.sERC1155 = await waffle.deployContract(ctx.signers.sERC1155.admin, _sERC1155_, [
      ctx.contracts.sERC20Base.address,
      ctx.params.sERC1155.unavailableURI,
      ctx.params.sERC1155.unlockedURI,
    ]);

    ctx.sERC1155 = new sERC1155(ctx);
  }

  async spectralize(opts = {}) {
    opts.collection ??= this.ctx.contracts.sERC721;
    opts.transfer ??= false;
    opts.mock ??= false;

    if (opts.mock) {
      this.ctx.contracts.ERC721Mock = await waffle.deployContract(this.this.ctx.signers.root, _ERC721Mock_);

      this.ctx.data.tx = await this.contract.sERC1155.spectralize(
        this.ctx.contracts.ERC721Mock.address,
        0,
        this.ctx.params.sERC20.name,
        this.ctx.params.sERC20.symbol,
        this.ctx.params.sERC20.cap,
        this.ctx.signers.sERC20.admin.address,
        this.ctx.signers.sERC20.guardian.address
      );

      this.ctx.data.receipt = await this.ctx.data.tx.wait();
      this.ctx.data.id = await this._id();
    } else {
      if (opts.transfer) {
        const data = this._data(opts);
        await this.ctx.sERC721.safeTransferFrom({ data });
        this.ctx.data.id = await this._id({ transfer: true });
      } else {
        this.ctx.data.tx = await this.ctx.contracts.sERC1155.spectralize(
          opts.collection.address,
          this.ctx.data.tokenId,
          this.ctx.params.sERC20.name,
          this.ctx.params.sERC20.symbol,
          this.ctx.params.sERC20.cap,
          this.ctx.signers.sERC20.admin.address,
          this.ctx.signers.sERC20.guardian.address
        );

        this.ctx.data.receipt = await this.ctx.data.tx.wait();
        this.ctx.data.id = await this._id();
      }
    }

    this.ctx.sERC20 = await sERC20.at(this.ctx, await this.contract.sERC20Of(this.ctx.data.id));
  }

  _data(opts = {}) {
    opts.short ??= false;
    opts.derrida ??= this.ctx.constants.sERC1155.DERRIDA;

    return opts.short
      ? ethers.utils.concat([
          ethers.utils.formatBytes32String(this.ctx.params.sERC20.name),
          ethers.utils.formatBytes32String(this.ctx.params.sERC20.symbol),
          ethers.utils.defaultAbiCoder.encode(['uint256'], [this.ctx.params.sERC20.cap]),
          ethers.utils.defaultAbiCoder.encode(['address'], [this.ctx.signers.sERC20.admin.address]),
          ethers.utils.defaultAbiCoder.encode(['address'], [this.ctx.signers.sERC20.guardian.address]),
        ])
      : ethers.utils.concat([
          ethers.utils.formatBytes32String(this.ctx.constants.name),
          ethers.utils.formatBytes32String(this.ctx.constants.symbol),
          ethers.utils.defaultAbiCoder.encode(['uint256'], [this.ctx.constants.cap]),
          ethers.utils.defaultAbiCoder.encode(['address'], [this.ctx.signers.sERC20.admin.address]),
          ethers.utils.defaultAbiCoder.encode(['address'], [this.ctx.signers.sERC20.guardian.address]),
          ethers.utils.defaultAbiCoder.encode(['bytes32'], [opts.derrida]),
        ]);
  }

  async _id(opts = {}) {
    opts.transfer ??= false;

    if (opts.transfer)
      return (await this.ctx.contracts.sERC1155.queryFilter(this.ctx.contracts.sERC1155.filters.Spectralize())).filter(
        (event) => event.event === 'Spectralize'
      )[0].args.id;
    else return this.ctx.data.receipt.events.filter((event) => event.event === 'Spectralize')[0].args.id;
  }
}

module.exports = sERC1155;
