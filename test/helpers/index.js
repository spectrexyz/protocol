const _sERC20_ = require("../../artifacts/contracts/token/sERC20.sol/sERC20.json");
const _ERC1155ReceiverMock_ = require("../../artifacts/contracts/mock/ERC1155ReceiverMock.sol/ERC1155ReceiverMock.json");
const _ERC721Mock_ = require("../../artifacts/contracts/mock/ERC721Mock.sol/ERC721Mock.json");
const _ERC721SenderMock_ = require("../../artifacts/contracts/mock/ERC721SenderMock.sol/ERC721SenderMock.json");
const config = require("./config");
const { Broker, Channeler, Issuer, Vault, sERC721, Pool, PoolFactory, Splitter } = require("./models");

const _signers = async (ctx) => {
  const signers = {
    sERC20: {},
    sERC721: { owners: [] },
    channeler: {},
    vault: {},
    splitter: { beneficiaries: [] },
    issuer: {},
    holders: [],
    owners: [],
    broker: {
      beneficiaries: [],
    },
    pool: {},
    others: [],
  };

  [
    signers.root,
    signers.owners[0],
    signers.owners[1],
    signers.owners[2],
    signers.holders[0],
    signers.holders[1],
    signers.holders[2],
    signers.sERC20.admin,
    signers.sERC20.minter,
    signers.sERC20.pauser,
    signers.sERC20.snapshoter,
    signers.sERC721.admin,
    signers.sERC721.minter,
    signers.sERC721.owners[0],
    signers.sERC721.owners[1],
    signers.broker.admin,
    signers.broker.bank,
    signers.broker.guardian,
    signers.broker.buyer,
    signers.broker.registrar,
    signers.broker.escaper,
    signers.broker.beneficiaries[0],
    signers.broker.beneficiaries[1],
    signers.channeler.admin,
    signers.channeler.guardian,
    signers.issuer.admin,
    signers.issuer.bank,
    signers.issuer.splitter,
    signers.issuer.guardian,
    signers.issuer.buyer,
    signers.issuer.registerer,
    signers.issuer.closer,
    signers.pool.owner,
    signers.splitter.admin,
    signers.splitter.bank,
    signers.splitter.registrar,
    signers.splitter.beneficiaries[0],
    signers.splitter.beneficiaries[1],
    signers.splitter.beneficiaries[2],
    signers.vault.admin,
    signers.vault.broker,
    signers.vault.operator,
    signers.vault.fractionalizer,
    ...signers.others
  ] = await ethers.getSigners();

  return signers;
};

const initialize = async (ctx) => {
  ctx.contracts = {};
  ctx.data = {};

  ctx.params = {
    sERC20: config.sERC20.params,
    sERC721: config.sERC721.params,
    broker: config.broker.params,
    channeler: config.channeler.params,
    issuer: config.issuer.params,
    pool: config.pool.params,
    splitter: config.splitter.params,
    vault: config.vault.params,
  };

  ctx.constants = {
    ONE: ethers.BigNumber.from(1),
    sERC20: config.sERC20.constants,
    sERC721: config.sERC721.constants,
    broker: config.broker.constants,
    channeler: config.channeler.constants,
    issuer: config.issuer.constants,
    pool: config.pool.constants,
    splitter: config.splitter.constants,
    vault: config.vault.constants,
  };

  ctx.signers = await _signers();
};

const mock = {
  deploy: {
    ERC1155Receiver: async (ctx, opts = {}) => {
      const RECEIVER_SINGLE_MAGIC_VALUE = "0xf23a6e61";
      const RECEIVER_BATCH_MAGIC_VALUE = "0xbc197c81";

      opts.singleValue ??= RECEIVER_SINGLE_MAGIC_VALUE;
      opts.singleReverts ??= false;
      opts.batchValue ??= RECEIVER_BATCH_MAGIC_VALUE;
      opts.batchReverts ??= false;

      ctx.contracts.ERC1155Receiver = await waffle.deployContract(ctx.signers.root, _ERC1155ReceiverMock_, [
        opts.singleValue,
        opts.singleReverts,
        opts.batchValue,
        opts.batchReverts,
      ]);
    },
    ERC721: async (ctx) => {
      ctx.contracts.ERC721Mock = await waffle.deployContract(ctx.signers.root, _ERC721Mock_);
    },
    ERC721Sender: async (ctx) => {
      ctx.contracts.ERC721SenderMock = await waffle.deployContract(ctx.signers.root, _ERC721SenderMock_);
    },
  },
};

const setup = {
  sERC20: async (ctx, opts = {}) => {
    await setup.vault(ctx, opts);
  },
  sERC721: async (ctx, opts = {}) => {
    await sERC721.deploy(ctx);
  },
  broker: async (ctx, opts = {}) => {
    opts.fractionalize ??= true;

    ctx.contracts.sERC20Base = await waffle.deployContract(ctx.signers.root, _sERC20_);

    await sERC721.deploy(ctx);
    await Vault.deploy(ctx);
    await Broker.deploy(ctx);

    await ctx.sERC721.mint(opts);
    await ctx.vault.fractionalize({ broker: ctx.broker });
  },
  channeler: async (ctx, opts = {}) => {
    ctx.contracts.sERC20Base = await waffle.deployContract(ctx.signers.root, _sERC20_);

    await sERC721.deploy(ctx);
    await Vault.deploy(ctx);
    await PoolFactory.deploy(ctx, opts);
    await Issuer.deploy(ctx, { minter: false });
    await Broker.deploy(ctx, { issuer: this.issuer });
    await Splitter.deploy(ctx);
    await Channeler.deploy(ctx);

    await ctx.sERC721.mint(opts);
  },
  issuer: async (ctx, opts = {}) => {
    opts.fractionalize ??= true;

    ctx.contracts.sERC20Base = await waffle.deployContract(ctx.signers.root, _sERC20_);

    await sERC721.deploy(ctx);
    await Vault.deploy(ctx);

    await ctx.sERC721.mint(opts);
    await ctx.vault.fractionalize({ broker: ctx.broker });
    await PoolFactory.deploy(ctx, opts);
    await Issuer.deploy(ctx, opts);
  },
  splitter: async (ctx, opts = {}) => {
    await setup.vault(ctx, opts);
    await Splitter.deploy(ctx);
  },
  vault: async (ctx, opts = {}) => {
    opts.fractionalize ??= true;

    ctx.contracts.sERC20Base = await waffle.deployContract(ctx.signers.root, _sERC20_);

    await sERC721.deploy(ctx);
    await Vault.deploy(ctx);

    await ctx.sERC721.mint(opts);

    if (opts.fractionalize) {
      opts.from = undefined;
      await ctx.vault.fractionalize(opts);
    }
  },
  pool: async (ctx, opts = {}) => {
    opts.fractionalize ??= true;

    ctx.contracts.sERC20Base = await waffle.deployContract(ctx.signers.root, _sERC20_);

    await sERC721.deploy(ctx);
    await Vault.deploy(ctx);

    await ctx.sERC721.mint(opts);
    await ctx.vault.fractionalize({ broker: ctx.broker });

    await Pool.deploy(ctx, opts);
  },
  poolFactory: async (ctx, opts = {}) => {
    opts.fractionalize ??= true;

    ctx.contracts.sERC20Base = await waffle.deployContract(ctx.signers.root, _sERC20_);

    await sERC721.deploy(ctx);
    await Vault.deploy(ctx);

    await ctx.sERC721.mint(opts);
    await ctx.vault.fractionalize({ broker: ctx.broker });

    await PoolFactory.deploy(ctx, opts);
  },
};

module.exports = {
  initialize,
  mock,
  setup,
};
