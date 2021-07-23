const _sERC20_ = require('@spectrexyz/protocol-core/artifacts/contracts/SERC20.sol/sERC20.json');
const { _throw } = require('../errors');

class sERC20 {
  constructor(ctx) {
    this.ctx = ctx;
    this.contract = ctx.contracts.sERC20;

    this.name = this.contract.name;
    this.symbol = this.contract.symbol;
    this.decimals = this.contract.decimals;
    this.cap = this.contract.cap;
    this.hasRole = this.contract.hasRole;
    this.totalSupply = this.contract.totalSupply;
    this.totalSupplyAt = this.contract.totalSupplyAt;
    this.balanceOfAt = this.contract.balanceOfAt;
  }

  static async deploy(ctx) {
    ctx.contracts.sERC20 = await waffle.deployContract(ctx.signers.sERC20.admin, _sERC20_);

    ctx.sERC20 = new sERC20(ctx);
  }

  static async at(ctx, address, opts = {}) {
    opts.permissions ??= true;
    opts.root ??= ctx.signers.root;

    ctx.contracts.sERC20 = new ethers.Contract(address, _sERC20_.abi, opts.root);

    const sERC20_ = new sERC20(ctx);

    if (opts.permissions) {
      await sERC20_._grantRoles();
    }

    return sERC20_;
  }

  async initialize(opts = {}) {
    opts.cap ??= this.ctx.params.sERC20.cap;
    opts.admin ??= this.ctx.signers.sERC20.admin;

    this.ctx.data.tx = await this.contract.initialize(this.ctx.params.sERC20.name, this.ctx.params.sERC20.symbol, opts.cap, opts.admin.address);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
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

  async approve(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.spender ??= this.ctx.contracts.Vault;
    opts.amount ??= this.ctx.params.sERC20.cap;

    this.ctx.data.tx = await this.ctx.contracts.sERC20.connect(opts.from).approve(opts.spender.address, opts.amount);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async mint(opts = {}) {
    opts.from ??= this.ctx.signers.sERC20.minter;
    opts.to ??= this.ctx.signers.holders[0];
    opts.amount ??= this.ctx.constants.balance;

    this.ctx.data.tx = await this.ctx.contracts.sERC20.connect(opts.from).mint(opts.to.address, opts.amount);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async transfer(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.to ??= this.ctx.contracts.sERC20Splitter;
    opts.amount ??= this.ctx.params.sERC20.amount;

    this.ctx.data.tx = await this.contract.connect(opts.from).transfer(opts.to.address, opts.amount);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async burn(opts = {}) {
    opts.from ??= this.ctx.signers.holders[0];
    opts.amount ??= this.ctx.params.sERC20.amount;

    this.ctx.data.tx = await this.contract.connect(opts.from).burn(opts.amount);
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
  }

  async snapshot() {
    this.ctx.data.tx = await this.contract.connect(this.ctx.signers.sERC20.snapshoter).snapshot();
    this.ctx.data.receipt = await this.ctx.data.tx.wait();
    this.ctx.data.snapshotId = this.ctx.data.receipt.events[0].args[0];
  }

  async _grantRoles() {
    await this.grantRole({ role: this.ctx.constants.sERC20.BURN_ROLE, account: this.ctx.signers.sERC20.burner });
    await this.grantRole({ role: this.ctx.constants.sERC20.MINT_ROLE, account: this.ctx.signers.sERC20.minter });
    await this.grantRole({ role: this.ctx.constants.sERC20.PAUSE_ROLE, account: this.ctx.signers.sERC20.pauser });
    await this.grantRole({ role: this.ctx.constants.sERC20.SNAPSHOT_ROLE, account: this.ctx.signers.sERC20.snapshoter });
  }
}

module.exports = sERC20;
