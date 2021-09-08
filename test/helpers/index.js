const _sERC20_ = require("../../artifacts/contracts/token/sERC20.sol/sERC20.json");
const _ERC1155ReceiverMock_ = require("../../artifacts/contracts/mock/ERC1155ReceiverMock.sol/ERC1155ReceiverMock.json");
const _ERC721Mock_ = require("../../artifacts/contracts/mock/ERC721Mock.sol/ERC721Mock.json");
const config = require("./config");
const { Broker, Balancer, Issuer, Template, Vault, sERC721, Splitter } = require("./models");

const _signers = async (ctx) => {
  const signers = {
    sERC20: {},
    sERC721: { owners: [] },
    vault: {},
    splitter: { beneficiaries: [] },
    issuer: {},
    holders: [],
    owners: [],
    broker: {
      beneficiaries: [],
    },
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
    signers.sERC721.owners[0],
    signers.sERC721.owners[1],
    signers.broker.admin,
    signers.broker.guardian,
    signers.broker.buyer,
    signers.broker.registrar,
    signers.broker.escaper,
    signers.broker.beneficiaries[0],
    signers.broker.beneficiaries[1],
    signers.issuer.admin,
    signers.issuer.bank,
    signers.issuer.splitter,
    signers.issuer.guardian,
    signers.issuer.recipient,
    signers.issuer.registerer,
    signers.splitter.admin,
    signers.splitter.registrar,
    signers.splitter.beneficiaries[0],
    signers.splitter.beneficiaries[1],
    signers.splitter.beneficiaries[2],
    signers.vault.admin,
    signers.vault.broker,
    signers.vault.operator,
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
    splitter: config.splitter.params,
    vault: config.vault.params,
    sBootstrappingPool: {
      pooled: {
        ETH: ethers.BigNumber.from("2000000000000000000"),
        sERC20: ethers.BigNumber.from("1000000000000000000"),
      },
      name: "My SBP Token",
      symbol: "$SBP",
      // normalizedStartWeight: ethers.BigNumber.from('300000000000000000'),
      // normalizedEndWeight: ethers.BigNumber.from('600000000000000000'),
      sERC20MaxWeight: ethers.BigNumber.from("600000000000000000"),
      sERC20MinWeight: ethers.BigNumber.from("300000000000000000"),
      swapFeePercentage: ethers.BigNumber.from("10000000000000000"),
      pauseWindowDuration: ethers.BigNumber.from("3000"),
      bufferPeriodDuration: ethers.BigNumber.from("1000"),
    },
    issuer: {
      protocolFee: ethers.BigNumber.from("2000000000000000000"), // 2e18 = 2%
      fee: ethers.BigNumber.from("5000000000000000000"), // 5%
      reserve: ethers.utils.parseEther("2"), // 2 sERC20 / ETH
      allocation: ethers.utils.parseEther("1").mul(ethers.BigNumber.from("10")), // 10%
      value: ethers.utils.parseEther("3"), // 3 ETH
    },
  };

  ctx.constants = {
    sERC20: config.sERC20.constants,
    vault: config.vault.constants,
    broker: config.broker.constants,
    splitter: config.splitter.constants,
    sBootstrappingPool: {
      ONE: ethers.BigNumber.from("1000000000000000000"),
      MINIMUM_BPT: ethers.BigNumber.from("1000000"),
      TWO_TOKEN_POOL: 2,
      ORACLE_VARIABLE: {
        PAIR_PRICE: 0,
        BPT_PRICE: 1,
        INVARIANT: 2,
      },
    },
    SpectreState: {
      Null: 0,
      Locked: 1,
      Unlocked: 2,
    },
    issuer: {
      DECIMALS: ethers.BigNumber.from("1000000000000000000"),
      HUNDRED: ethers.BigNumber.from("100000000000000000000"),
      ONE: ethers.BigNumber.from("1000000000000000000"),
      issuances: {
        state: {
          PENDING: 1,
          OPEN: 2,
          CLOSED: 3,
        },
      },
    },
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
  },
};

const setupback = async (ctx, opts = {}) => {
  opts.approve ??= true;
  opts.balancer ??= false;
  opts.spectralize ??= true;
  opts.minter ??= false;
  opts.register ??= true;
  opts.broker ??= false;
  opts.template ??= false;

  ctx.contracts.sERC20Base = await waffle.deployContract(ctx.signers.root, _sERC20_);

  await sERC721.deploy(ctx);
  await sERC1155.deploy(ctx);
  await ctx.sERC721.mint(opts);
  await Splitter.deploy(ctx);

  if (opts.spectralize) {
    await ctx.sERC1155.spectralize();
  }

  if (opts.balancer || opts.template) {
    // await sBootstrappingPool.deploy(ctx, opts);
    // ctx.data.poolId = await ctx.sBootstrappingPool.getPoolId();
  }

  if (opts.issuer || opts.template) {
    await Balancer.deploy(ctx, opts);
    await Issuer.deploy(ctx, opts);

    await ctx.issuer.grantRole({ role: await ctx.issuer.REGISTER_ROLE(), account: ctx.signers.issuer.registerer });

    await ctx.sERC20.grantRole({
      role: ctx.constants.sERC20.MINT_ROLE,
      account: ctx.issuer.contract,
    });
  }

  if (opts.broker || opts.template) {
    await Broker.deploy(ctx, opts);
    await ctx.sERC721.mint(opts);
    await ctx.sERC1155.spectralize({ guardian: ctx.broker.contract });

    await ctx.sERC20.grantRole({
      role: ctx.constants.sERC20.BURN_ROLE,
      account: ctx.broker.contract,
    });
  }

  if (opts.template) {
    await Template.deploy(ctx, opts);
  }
};

const setup = {
  sERC20: async (ctx, opts = {}) => {
    await setup.vault(ctx, opts);
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
      await ctx.vault.fractionalize();
    }
  },
};

module.exports = {
  initialize,
  mock,
  setup,
};
