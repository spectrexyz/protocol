const _sERC721_ = require('@spectrexyz/protocol-core/artifacts/contracts/SERC721.sol/sERC721.json');
const { _throw } = require('../errors');

class sERC721 {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.sERC721;
  }

  static async deploy(ctx) {
    ctx.contracts.sERC721 = await waffle.deployContract(ctx.signers.root, _sERC721_, [ctx.params.sERC721.name, ctx.params.sERC721.symbol]);
    ctx.sERC721 = new sERC721(ctx);
  }

  async mint(opts = {}) {
    opts.approve ??= true;

    this.ctx.data.tx = await this.contract.mint(this.ctx.signers.sERC721.owners[0].address, this.ctx.params.sERC721.tokenURI);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
    this.ctx.data.tokenId = this.ctx.data.receipt.events[0].args.tokenId.toString();

    if (opts.approve) await this.approve(opts);
  }

  async transfer(opts = {}) {
    opts.from ??= this.ctx.signers.sERC721.owners[0];
    opts.to ??= this.ctx.contracts.sERC1155;

    this.ctx.data.tx = await this.contract.connect(opts.from).transferFrom(opts.from.address, opts.to.address, this.ctx.data.tokenId);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async approve(opts = {}) {
    opts.from ??= this.ctx.signers.sERC721.owners[0];

    this.ctx.data.tx = await this.ctx.contracts.sERC721.connect(opts.from).approve(this.ctx.contracts.sERC1155.address, this.ctx.data.tokenId);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async safeTransferFrom(opts = {}) {
    opts.from ??= this.ctx.signers.sERC721.owners[0];
    opts.to ??= this.ctx.contracts.sERC1155;
    opts.data ??= '0x00';

    this.ctx.data.tx = await this.contract
      .connect(opts.from)
      ['safeTransferFrom(address,address,uint256,bytes)'](opts.from.address, opts.to.address, this.ctx.data.tokenId, opts.data);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
    this.ctx.data.tx2 = this.ctx.data.tx; // fix a bug where an un-waited tx overrides the current tx somewhere
  }
}

module.exports = sERC721;
