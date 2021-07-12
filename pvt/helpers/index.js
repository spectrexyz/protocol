const SERC20 = require('@spectrexyz/protocol-core/artifacts/contracts/SERC20.sol/sERC20.json');
const ERC1155Receiver = require('@spectrexyz/protocol-core/artifacts/contracts/test/ERC1155ReceiverMock.sol/ERC1155ReceiverMock.json');
const ERC721Mock = require('@spectrexyz/protocol-core/artifacts/contracts/test/ERC721Mock.sol/ERC721Mock.json');

const { deployContract } = require('ethereum-waffle');

const { ethers } = require('hardhat');
const Decimal = require('decimal.js');
// const sERC20 = require('../../core/test/helpers/models/sERC20');
const RECEIVER_SINGLE_MAGIC_VALUE = '0xf23a6e61';
const RECEIVER_BATCH_MAGIC_VALUE = '0xbc197c81';

const sERC721 = require('./models/sERC721');
const sERC1155 = require('./models/sERC1155');
const sBootstrappingPool = require('./models/sBootstrappingPool');

const initialize = async (ctx) => {
  ctx.params = {
    sERC20: {
      cap: ethers.utils.parseEther('1000'),
      name: 'My Awesome sERC20',
      symbol: 'MAS',
      cap: ethers.utils.parseEther('1000'),
      balance: ethers.BigNumber.from('100000000000000000000'),
      amount: ethers.BigNumber.from('10000000000000000000'),
    },
    sERC721: {
      name: 'sERC721 Collection',
      symbol: 'SERC721',
      tokenURI: 'ipfs://Qm.../',
    },
    sERC1155: {
      unlockedURI: 'ipfs://Qm.../unwrapped',
      unavailableURI: 'ipfs://Qm.../unavailable',
      amount: ethers.BigNumber.from('10000000000000000000'),
      amount1: ethers.BigNumber.from('70000000000000000000'),
      amount2: ethers.BigNumber.from('12000000000000000000'),
    },
    sBootstrappingPool: {
      pooled: {
        ETH: ethers.BigNumber.from('2000000000000000000'),
        sERC20: ethers.BigNumber.from('1000000000000000000'),
      },
      name: 'My SBP Token',
      symbol: '$SBP',
      normalizedStartWeight: ethers.BigNumber.from('300000000000000000'),
      normalizedEndWeight: ethers.BigNumber.from('600000000000000000'),
      swapFeePercentage: ethers.BigNumber.from('10000000000000000'),
      pauseWindowDuration: ethers.BigNumber.from('3000'),
      bufferPeriodDuration: ethers.BigNumber.from('1000'),
    },
  };

  ctx.constants = {
    sERC20: {
      BURNER_ROLE: ethers.BigNumber.from('0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848'),
      MINTER_ROLE: ethers.BigNumber.from('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'),
      PAUSER_ROLE: ethers.BigNumber.from('0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a'),
      SNAPSHOTER_ROLE: ethers.BigNumber.from('0xe81b7fde06adf1242da26197bd147d2a1b7c0c31ac749e1d4b2c4a883f986140'),
    },
    sERC1155: {
      DERRIDA: '0x1d2496c631fd6d8be20fb18c5c1fa9499e1f28016c62da960ec6dcf752f2f7ce',
      ADMIN_ROLE: ethers.BigNumber.from('0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775'),
    },
    sBootstrappingPool: {
      ONE: ethers.BigNumber.from('1000000000000000000'),
      MINIMUM_BPT: ethers.BigNumber.from('1000000'),
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
    unlockedURI: 'ipfs://Qm.../unwrapped',
    unavailableURI: 'ipfs://Qm.../unavailable',
    tokenURI: 'ipfs://Qm.../',
    name: 'My Awesome sERC20',
    symbol: 'MAS',
    cap: ethers.utils.parseEther('1000'),
    balance: ethers.BigNumber.from('100000000000000000000'),
    // 1000000000000000000000
    // 100000000000000000000
    // 1000000000000000000000
    pooledETH: ethers.BigNumber.from('2000000000000000000'),
    pooledSERC20: ethers.BigNumber.from('1000000000000000000'),
    amount: ethers.BigNumber.from('10000000000000000000'),
    amount1: ethers.BigNumber.from('70000000000000000000'),
    amount2: ethers.BigNumber.from('12000000000000000000'),
    shares: [ethers.BigNumber.from('300000000000000000'), ethers.BigNumber.from('100000000000000000'), ethers.BigNumber.from('600000000000000000')],
  };

  ctx.contracts = {};

  ctx.data = {};

  ctx.signers = {
    sERC20: {},
    sERC721: { owners: [] },
    sERC1155: {},
    holders: [],
    owners: [],
    beneficiaries: [],
    others: [],
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
    ...ctx.signers.others
  ] = await ethers.getSigners();
};

const computeInvariant = (balances, weights) => {
  const BASE = new Decimal('1000000000000000000');

  balances[0] = new Decimal(balances[0].toString());
  balances[1] = new Decimal(balances[1].toString());
  weights[0] = new Decimal(weights[0].toString());
  weights[1] = new Decimal(weights[1].toString());

  const invariant = balances[0].pow(weights[0].div(BASE)).mul(balances[1].pow(weights[1].div(BASE)));

  return ethers.BigNumber.from(invariant.truncated().toString());
};

const register = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.admin;
  opts.beneficiaries ??= [ctx.signers.beneficiaries[0], ctx.signers.beneficiaries[1], ctx.signers.beneficiaries[2]];
  opts.shares ??= [ctx.constants.shares[0], ctx.constants.shares[1], ctx.constants.shares[2]];

  ctx.contracts.SERC20Splitter = ctx.contracts.SERC20Splitter.connect(opts.from);
  ctx.data.tx = await ctx.contracts.SERC20Splitter.register(
    ctx.contracts.sERC20.address,
    opts.beneficiaries.map((beneficiary) => beneficiary.address),
    opts.shares
  );
  ctx.data.receipt = await ctx.data.tx.wait();
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

  ctx.contracts.sERC20Base = await deployContract(ctx.signers.root, SERC20);

  await sERC721.deploy(ctx);
  await sERC1155.deploy(ctx);
  await ctx.sERC721.mint(opts);
  // ctx.contracts.SERC20Splitter = await deployContract(ctx.signers.root, SERC20Splitter, [ctx.signers.admin.address]);

  if (opts.spectralize) {
    await ctx.sERC1155.spectralize();
  }

  if (opts.balancer) {
    await sBootstrappingPool.deploy(ctx, opts);
    ctx.data.poolId = await ctx.sBootstrappingPool.getPoolId();
  }
};

const withdraw = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.beneficiaries[0];

  ctx.data.tx = await ctx.contracts.SERC20Splitter.withdraw(ctx.contracts.sERC20.address, opts.from.address);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const withdrawBatch = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.beneficiaries[0];

  ctx.data.tx = await ctx.contracts.SERC20Splitter.withdrawBatch([ctx.data.sERC201.address, ctx.data.sERC202.address], opts.from.address);
  ctx.data.receipt = await ctx.data.tx.wait();
};

module.exports = {
  initialize,
  register,
  mock,
  setup,
  withdraw,
  withdrawBatch,
};
