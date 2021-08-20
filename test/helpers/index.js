const SERC20 = require("../../artifacts/contracts/core/sERC20.sol/sERC20.json");
const ERC1155Receiver = require("../../artifacts/contracts/test/ERC1155ReceiverMock.sol/ERC1155ReceiverMock.json");
const ERC721Mock = require("../../artifacts/contracts/test/ERC721Mock.sol/ERC721Mock.json");

const { deployContract } = require("ethereum-waffle");

const { ethers } = require("hardhat");
const Decimal = require("decimal.js");
const RECEIVER_SINGLE_MAGIC_VALUE = "0xf23a6e61";
const RECEIVER_BATCH_MAGIC_VALUE = "0xbc197c81";

const sERC721 = require("./models/sERC721");
const sERC1155 = require("./models/sERC1155");
const sBootstrappingPool = require("./models/sBootstrappingPool");
const sSplitter = require("./models/sSplitter");
const sMinter = require("./models/sMinter");
const { Broker, Template } = require("./models");

const initialize = async (ctx) => {
  ctx.params = {
    sERC20: {
      cap: ethers.utils.parseEther("1000"),
      name: "My Awesome sERC20",
      symbol: "MAS",
      cap: ethers.utils.parseEther("1000"),
      balance: ethers.BigNumber.from("100000000000000000000"),
      amount: ethers.BigNumber.from("10000000000000000000"),
    },
    sERC721: {
      name: "sERC721 Collection",
      symbol: "SERC721",
      tokenURI: "ipfs://Qm.../",
    },
    sERC1155: {
      unlockedURI: "ipfs://Qm.../unwrapped",
      unavailableURI: "ipfs://Qm.../unavailable",
      amount: ethers.BigNumber.from("10000000000000000000"),
      amount1: ethers.BigNumber.from("70000000000000000000"),
      amount2: ethers.BigNumber.from("12000000000000000000"),
    },
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
    broker: {
      minimum: ethers.utils.parseEther("2.5"),
      multiplier: ethers.utils.parseEther("1.5"),
      timelock: ethers.BigNumber.from("1209600"), // two weeks
    },
    sSplitter: {
      shares: [ethers.BigNumber.from("300000000000000000"), ethers.BigNumber.from("100000000000000000"), ethers.BigNumber.from("600000000000000000")],
    },
    sMinter: {
      protocolFee: ethers.BigNumber.from("2000000000000000000"), // 2e18 = 2%
      fee: ethers.BigNumber.from("5000000000000000000"), // 5%
      initialPrice: ethers.utils.parseEther("2"), // 2 sERC20 / ETH
      allocation: ethers.utils.parseEther("1").mul(ethers.BigNumber.from("10")), // 10%
      value: ethers.utils.parseEther("3"), // 3 ETH
    },
  };

  ctx.constants = {
    sERC20: {
      DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
      BURN_ROLE: ethers.BigNumber.from("0xe97b137254058bd94f28d2f3eb79e2d34074ffb488d042e3bc958e0a57d2fa22"),
      MINT_ROLE: ethers.BigNumber.from("0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686"),
      PAUSE_ROLE: ethers.BigNumber.from("0x139c2898040ef16910dc9f44dc697df79363da767d8bc92f2e310312b816e46d"),
      SNAPSHOT_ROLE: ethers.BigNumber.from("0x5fdbd35e8da83ee755d5e62a539e5ed7f47126abede0b8b10f9ea43dc6eed07f"),
    },
    sERC1155: {
      DERRIDA: "0x1d2496c631fd6d8be20fb18c5c1fa9499e1f28016c62da960ec6dcf752f2f7ce",
      ADMIN_ROLE: ethers.BigNumber.from("0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775"),
    },
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
    broker: {
      sales: {
        state: {
          PENDING: 1,
          OPEN: 2,
          CLOSED: 3,
        },
      },
    },
    SpectreState: {
      Null: 0,
      Locked: 1,
      Unlocked: 2,
    },
    sMinter: {
      DECIMALS: ethers.BigNumber.from("1000000000000000000"),
      HUNDRED: ethers.BigNumber.from("100000000000000000000"),
      ONE: ethers.BigNumber.from("1000000000000000000"),
    },
    unlockedURI: "ipfs://Qm.../unwrapped",
    unavailableURI: "ipfs://Qm.../unavailable",
    tokenURI: "ipfs://Qm.../",
    name: "My Awesome sERC20",
    symbol: "MAS",
    cap: ethers.utils.parseEther("1000"),
    balance: ethers.BigNumber.from("100000000000000000000"),
    // 1000000000000000000000
    // 100000000000000000000
    // 1000000000000000000000
    pooledETH: ethers.BigNumber.from("2000000000000000000"),
    pooledSERC20: ethers.BigNumber.from("1000000000000000000"),
    amount: ethers.BigNumber.from("10000000000000000000"),
    amount1: ethers.BigNumber.from("70000000000000000000"),
    amount2: ethers.BigNumber.from("12000000000000000000"),
  };

  ctx.contracts = {};

  ctx.data = {};

  ctx.signers = {
    sERC20: {},
    sERC721: { owners: [] },
    sERC1155: {},
    sSplitter: { beneficiaries: [] },
    sMinter: {},
    holders: [],
    owners: [],
    beneficiaries: [],
    others: [],
    broker: {},
  };

  [
    ctx.signers.root,
    ctx.signers.admin,
    ctx.signers.owners[0],
    ctx.signers.owners[1],
    ctx.signers.owners[2],
    ctx.signers.holders[0],
    ctx.signers.holders[1],
    ctx.signers.holders[2],
    ctx.signers.beneficiaries[0],
    ctx.signers.beneficiaries[1],
    ctx.signers.beneficiaries[2],
    ctx.signers.sERC1155.admin,
    ctx.signers.sERC1155.guardian,
    ctx.signers.sERC1155.operator,
    ctx.signers.sERC20.admin,
    ctx.signers.sERC20.burner,
    ctx.signers.sERC20.minter,
    ctx.signers.sERC20.pauser,
    ctx.signers.sERC20.snapshoter,
    ctx.signers.sERC721.owners[0],
    ctx.signers.sERC721.owners[1],
    ctx.signers.sSplitter.admin,
    ctx.signers.sSplitter.registrar,
    ctx.signers.sSplitter.beneficiaries[0],
    ctx.signers.sSplitter.beneficiaries[1],
    ctx.signers.sSplitter.beneficiaries[2],
    ctx.signers.sMinter.admin,
    ctx.signers.sMinter.bank,
    ctx.signers.sMinter.splitter,
    ctx.signers.sMinter.beneficiary,
    ctx.signers.sMinter.recipient,
    ctx.signers.sMinter.registerer,
    ctx.signers.broker.guardian,
    ctx.signers.broker.buyer,
    ctx.signers.broker.beneficiary,
    ...ctx.signers.others
  ] = await ethers.getSigners();
};

const computeInvariant = (balances, weights) => {
  const BASE = new Decimal("1000000000000000000");

  balances[0] = new Decimal(balances[0].toString());
  balances[1] = new Decimal(balances[1].toString());
  weights[0] = new Decimal(weights[0].toString());
  weights[1] = new Decimal(weights[1].toString());

  const invariant = balances[0].pow(weights[0].div(BASE)).mul(balances[1].pow(weights[1].div(BASE)));

  return ethers.BigNumber.from(invariant.truncated().toString());
};

const mock = {
  deploy: {
    ERC1155Receiver: async (ctx, opts = {}) => {
      opts.singleValue ??= RECEIVER_SINGLE_MAGIC_VALUE;
      opts.singleReverts ??= false;
      opts.batchValue ??= RECEIVER_BATCH_MAGIC_VALUE;
      opts.batchReverts ??= false;

      ctx.contracts.ERC1155Receiver = await deployContract(ctx.signers.root, ERC1155Receiver, [
        opts.singleValue,
        opts.singleReverts,
        opts.batchValue,
        opts.batchReverts,
      ]);
    },
    ERC721: async (ctx) => {
      ctx.contracts.ERC721Mock = await deployContract(ctx.signers.root, ERC721Mock);
    },
  },
};

const setup = async (ctx, opts = {}) => {
  opts.approve ??= true;
  opts.balancer ??= false;
  opts.spectralize ??= true;
  opts.minter ??= false;
  opts.register ??= true;
  opts.broker ??= false;
  opts.template ??= false;

  ctx.contracts.sERC20Base = await deployContract(ctx.signers.root, SERC20);

  await sERC721.deploy(ctx);
  await sERC1155.deploy(ctx);
  await ctx.sERC721.mint(opts);
  await sSplitter.deploy(ctx);

  if (opts.spectralize) {
    await ctx.sERC1155.spectralize();
  }

  if (opts.balancer || opts.template) {
    await sBootstrappingPool.deploy(ctx, opts);
    ctx.data.poolId = await ctx.sBootstrappingPool.getPoolId();
  }

  if (opts.minter || opts.template) {
    await sMinter.deploy(ctx, opts);
    await ctx.sERC20.grantRole({
      role: ctx.constants.sERC20.MINT_ROLE,
      account: ctx.sMinter.contract,
    });
    if (opts.register) await ctx.sMinter.register();
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

module.exports = {
  initialize,
  mock,
  setup,
};
