const _Template_ = require("../../../artifacts/contracts/template/Template.sol/Template.json");

class Template {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.template;
    this.sERC1155 = this.contract.sERC1155;
  }

  static async deploy(ctx) {
    ctx.contracts.template = await waffle.deployContract(
      ctx.signers.root,
      _Template_,
      [
        ctx.contracts.sERC1155.address,
        ctx.contracts.sMinter.address,
        ctx.contracts.broker.address,
        ctx.contracts.WETH.address,
        ctx.contracts.sSplitter.address,
        ctx.contracts.Vault.address,
      ]
    );

    //     constructor(
    //     address sERC1155,
    //     address minter,
    //     address broker,
    //     address weth,
    //     address splitter,
    //     address vault
    // )

    ctx.template = new Template(ctx);
  }

  async register(opts = {}) {
    opts.from ??= this.ctx.signers.sSplitter.registrar;
    opts.beneficiaries ??= this.ctx.signers.sSplitter.beneficiaries;
    opts.shares ??= this.ctx.params.sSplitter.shares;

    this.ctx.data.tx = await this.contract.connect(opts.from).register(
      this.ctx.sERC20.contract.address,
      opts.beneficiaries.map((beneficiary) => beneficiary.address),
      opts.shares
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async withdraw(opts = {}) {
    opts.from ??= this.ctx.signers.sSplitter.beneficiaries[0];

    this.ctx.data.tx = await this.contract.withdraw(
      this.ctx.sERC20.contract.address,
      opts.from.address
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async withdrawBatch(opts = {}) {
    opts.from ??= this.ctx.signers.sSplitter.beneficiaries[0];

    this.ctx.data.tx = await this.contract.withdrawBatch(
      [this.ctx.data.sERC201.address, this.ctx.data.sERC202.address],
      opts.from.address
    );
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }
}

module.exports = Template;
