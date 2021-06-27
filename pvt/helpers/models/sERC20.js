const _sERC20 = require('@spectrexyz/protocol-core/artifacts/contracts/SERC20.sol/sERC20.json');
const { _throw } = require('../errors');

class sERC20 {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.sERC20;

    this.cap = this.contract.cap;
    this.totalSupply = this.contract.totalSupply;
  }

  static async at(ctx, address, opts = {}) {
    opts.permissions ??= true;
    opts.root ??= ctx.signers.root;

    ctx.contracts.sERC20 = new ethers.Contract(address, _sERC20.abi, opts.root);

    const sERC20_ = new sERC20(ctx);

    if (opts.permissions) {
      await sERC20_._grantRoles();
    }

    return sERC20_;
  }

  async balanceOf(account) {
    return await this.contract.balanceOf(account.address);
  }

  async hasRole(role, account) {
    return await this.contract.hasRole(role, account.address);
  }

  async pause(opts = {}) {
    opts.from ??= this.ctx.signers.sERC20.pauser;

    this.ctx.data.tx = await this.contract.connect(opts.from).pause();
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async unpause(opts = {}) {
    opts.from ??= this.ctx.signers.sERC20.pauser;

    this.ctx.data.tx = await this.contract.connect(opts.from).unpause();
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async grantRole(opts = {}) {
    opts.account ?? _throw('sERC20 » grantRole » account required');
    opts.role ?? _throw('sERC20 » grantRole » role required');
    opts.from ??= this.ctx.signers.sERC20.admin;

    this.ctx.data.tx = await this.ctx.contracts.sERC20.connect(opts.from).grantRole(opts.role, opts.account.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async mint(opts = {}) {
    opts.from ??= this.ctx.signers.sERC20.minter;
    opts.to ??= this.ctx.signers.holders[0];
    opts.amount ??= this.ctx.constants.balance;

    this.ctx.data.tx = await this.ctx.contracts.sERC20.connect(opts.from).mint(opts.to.address, opts.amount);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async _grantRoles() {
    await this.grantRole({ role: this.ctx.constants.sERC20.BURNER_ROLE, account: this.ctx.signers.sERC20.burner });
    await this.grantRole({ role: this.ctx.constants.sERC20.MINTER_ROLE, account: this.ctx.signers.sERC20.minter });
    await this.grantRole({ role: this.ctx.constants.sERC20.PAUSER_ROLE, account: this.ctx.signers.sERC20.pauser });
    await this.grantRole({ role: this.ctx.constants.sERC20.SNAPSHOTER_ROLE, account: this.ctx.signers.sERC20.snapshoter });
  }
}

module.exports = sERC20;
