const SERC20 = require('@spectrexyz/protocol-core/artifacts/contracts/SERC20.sol/sERC20.json');
const SERC721 = require('@spectrexyz/protocol-core/artifacts/contracts/SERC721.sol/sERC721.json');
const SERC1155 = require('@spectrexyz/protocol-core/artifacts/contracts/SERC1155.sol/sERC1155.json');
const SERC20Splitter = require('@spectrexyz/protocol-infrastructure/artifacts/contracts/SERC20Splitter.sol/SERC20Splitter.json');
const ERC1155Receiver = require('@spectrexyz/protocol-core/artifacts/contracts/test/ERC1155ReceiverMock.sol/ERC1155ReceiverMock.json');
const ERC721Mock = require('@spectrexyz/protocol-core/artifacts/contracts/test/ERC721Mock.sol/ERC721Mock.json');
// const CloneFactory = require('../../artifacts/contracts/test/CloneFactory.sol/CloneFactory.json');
const WETH = require('@spectrexyz/protocol-spectralization-bootstrapping-pool/artifacts/contracts/test/WETH.sol/WETH.json');
const Vault = require('@spectrexyz/protocol-spectralization-bootstrapping-pool/artifacts/@balancer-labs/v2-vault/contracts/Vault.sol/Vault.json');
const Authorizer = require('@spectrexyz/protocol-spectralization-bootstrapping-pool/artifacts/@balancer-labs/v2-vault/contracts/Authorizer.sol/Authorizer.json');
const SBP = require('@spectrexyz/protocol-spectralization-bootstrapping-pool/artifacts/contracts/SpectralizationBootstrappingPool.sol/SpectralizationBootstrappingPool.json');
const OracleMock = require('@spectrexyz/protocol-spectralization-bootstrapping-pool/artifacts/contracts/test/OracleMock.sol/OracleMock.json');

const { deployContract } = require('ethereum-waffle');

const { expect, Assertion, assert } = require('chai');
const { ethers, network } = require('hardhat');
const Decimal = require('decimal.js');
// const sERC20 = require('../../core/test/helpers/models/sERC20');
const RECEIVER_SINGLE_MAGIC_VALUE = '0xf23a6e61';
const RECEIVER_BATCH_MAGIC_VALUE = '0xbc197c81';
const DERRIDA = '0x1d2496c631fd6d8be20fb18c5c1fa9499e1f28016c62da960ec6dcf752f2f7ce';

const sERC20 = require('./models/sERC20');
const sERC721 = require('./models/sERC721');
const sERC1155 = require('./models/sERC1155');

Assertion.addMethod('near', function(actual, _epsilon) {
  const expected = this._obj;
  const delta = expected.sub(actual).abs();
  const epsilon = ethers.BigNumber.from(_epsilon);

  this.assert(delta.abs().lte(epsilon), 'expected #{exp} to be near #{act}', 'expected #{exp} to not be near #{act}', expected, actual);
});

const initialize = async (ctx) => {
  ctx.artifacts = {
    SERC20,
    SERC721,
    SERC1155,
  };

  ctx.params = {
    sERC20: {
      cap: ethers.utils.parseEther('1000'),
      name: 'My Awesome sERC20',
      symbol: 'MAS',
      cap: ethers.utils.parseEther('1000'),
      balance: ethers.BigNumber.from('100000000000000000000'),
    },
    sERC721: {
      name: 'sERC721 Collection',
      symbol: 'SERC721',
      tokenURI: 'ipfs://Qm.../',
    },
    sERC1155: {
      unlockedURI: 'ipfs://Qm.../unwrapped',
      unavailableURI: 'ipfs://Qm.../unavailable',
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
    pool: {
      name: 'My SBP Token',
      symbol: '$SBP',
      normalizedStartWeight: ethers.BigNumber.from('300000000000000000'),
      normalizedEndWeight: ethers.BigNumber.from('600000000000000000'),
      swapFeePercentage: ethers.BigNumber.from('10000000000000000'),
      pauseWindowDuration: ethers.BigNumber.from('3000'),
      bufferPeriodDuration: ethers.BigNumber.from('1000'),
      ONE: ethers.BigNumber.from('1000000000000000000'),
      MINIMUM_BPT: ethers.BigNumber.from('1000000'),
      TWO_TOKEN_POOL: 2,
      ORACLE_VARIABLE: {
        PAIR_PRICE: 0,
        BPT_PRICE: 1,
        INVARIANT: 2,
      },
    },
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
    ctx.signers.operator,
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
    ctx.signers.sERC20.admin,
    ctx.signers.sERC20.guardian,
    ctx.signers.sERC20.burner,
    ctx.signers.sERC20.minter,
    ctx.signers.sERC20.pauser,
    ctx.signers.sERC20.snapshoter,
    ctx.signers.sERC721.owners[0],
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

const join = async (ctx, opts = {}) => {
  const JOIN_KIND_INIT = 0;
  const JOIN_EXACT_TOKENS = 1;
  const JOIN_EXACT_BPT = 2;

  opts.from ??= ctx.signers.holders[0];
  opts.init ??= false;

  const joinPoolRequest = {
    assets: [ctx.contracts.sERC20.address, ethers.constants.AddressZero],
    maxAmountsIn: [ctx.constants.pooledSERC20, ctx.constants.pooledETH],
    userData: ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256[]'],
      [opts.init ? JOIN_KIND_INIT : JOIN_EXACT_TOKENS, [ctx.constants.pooledSERC20, ctx.constants.pooledETH]]
    ),
    fromInternalBalance: false,
  };

  ctx.contracts.Vault = ctx.contracts.Vault.connect(opts.from);
  ctx.data.tx = await ctx.contracts.Vault.joinPool(ctx.data.poolId, opts.from.address, opts.from.address, joinPoolRequest, {
    value: ctx.constants.pooledETH,
  });

  ctx.data.receipt = await ctx.data.tx.wait();
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

const mint = {
  sERC721: async (ctx, opts = { approve: true }) => {
    ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.root);
    ctx.data.receipt = await (await ctx.contracts.sERC721.mint(ctx.signers.owners[0].address, ctx.constants.tokenURI)).wait();
    ctx.data.tokenId = ctx.data.receipt.events[0].args.tokenId.toString();

    if (opts.approve) {
      ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.owners[0]);
      await (await ctx.contracts.sERC721.approve(ctx.contracts.sERC1155.address, ctx.data.tokenId)).wait();
    }
  },
  sERC20: async (ctx, opts = {}) => {
    console.log();

    opts.from ??= ctx.signers.sERC20.minter;
    opts.to ??= ctx.signers.holders[0];
    opts.amount ??= ctx.constants.balance;

    ctx.data.tx = await ctx.contracts.sERC20.connect(opts.from).mint(opts.to.address, opts.amount);
    ctx.data.receipt = await ctx.data.tx.wait();
  },
};

const setApprovalForAll = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.holders[0];
  opts.operator ??= ctx.signers.operator;
  opts.approve ??= true;

  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(opts.from);
  ctx.data.tx = await ctx.contracts.sERC1155.setApprovalForAll(opts.operator.address, opts.approve);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const safeTransferFrom = async (ctx, opts = {}) => {
  opts.from = opts.from ? opts.from : ctx.signers.holders[0];
  opts.operator = opts.operator ? opts.operator : opts.from;
  opts.to = opts.to ? opts.to : ctx.signers.others[0];
  opts.id = opts.id ? opts.id : ctx.data.id;
  opts.amount = opts.amount ? opts.amount : ctx.constants.amount;
  opts.data = opts.data ? opts.data : ethers.constants.HashZero;

  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(opts.operator);
  ctx.data.tx = await ctx.contracts.sERC1155.safeTransferFrom(opts.from.address, opts.to.address, opts.id, opts.amount, opts.data);
  ctx.data.receipt = await ctx.data.tx.wait();
};

const safeBatchTransferFrom = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.holders[0];
  opts.operator ??= opts.from;
  opts.to ??= ctx.signers.others[0];
  opts.ids ??= [ctx.data.id1, ctx.data.id2];
  opts.amounts ??= [ctx.constants.amount1, ctx.constants.amount2];
  opts.data ??= ethers.constants.HashZero;

  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(opts.operator);
  ctx.data.tx = await ctx.contracts.sERC1155.safeBatchTransferFrom(opts.from.address, opts.to.address, opts.ids, opts.amounts, opts.data);
  ctx.data.receipt = await ctx.data.tx.wait();
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
  // ctx.contracts.OracleMock = await deployContract(ctx.signers.root, OracleMock);

  if (opts.balancer) {
    ctx.contracts.WETH = await deployContract(ctx.signers.root, WETH);
    ctx.contracts.Authorizer = await deployContract(ctx.signers.root, Authorizer, [ctx.signers.admin.address]);
    ctx.contracts.Vault = await deployContract(ctx.signers.root, Vault, [ctx.contracts.Authorizer.address, ctx.contracts.WETH.address, 0, 0]);
    await spectralize(ctx);
    await mint.sERC20(ctx);
    console.log(ctx.contracts.WETH.address);
    console.log(ctx.contracts.sERC20.address);
    ctx.contracts.SBP = await deployContract(ctx.signers.root, SBP, [
      ctx.contracts.Vault.address,
      ctx.constants.pool.name,
      ctx.constants.pool.symbol,
      ctx.contracts.sERC20.address,
      ctx.contracts.WETH.address,
      ctx.constants.pool.normalizedStartWeight,
      ctx.constants.pool.normalizedEndWeight,
      ctx.constants.pool.swapFeePercentage,
      ctx.constants.pool.pauseWindowDuration,
      ctx.constants.pool.bufferPeriodDuration,
      true,
    ]);

    await approve.sERC20(ctx);

    ctx.data.poolId = await ctx.contracts.SBP.getPoolId();
  }

  if (opts.spectralize) {
    await ctx.sERC1155.spectralize();
  }
};

const _throw = (msg) => {
  throw new Error(msg);
};

const grantRole = {
  sERC20: async (ctx, opts = {}) => {
    // console.log(opts.account);
    opts.account ?? _throw('sERC20 » grantRole » account required');
    opts.role ?? _throw('sERC20 » grantRole » role required');

    opts.from ??= ctx.signers.sERC20.admin;
    opts.role = opts.role + '_ROLE';

    console.log(opts.role);
    console.log(await ctx.contracts.sERC20[opts.role]());
    console.log(await ctx.contracts.sERC20.MINTER_ROLE());

    ctx.data.tx = await ctx.contracts.sERC20.connect(opts.from).grantRole(await ctx.contracts.sERC20[opts.role](), opts.account.address);
    ctx.data.receipt = await ctx.data.tx.wait();
  },
};

const approve = {
  sERC20: async (ctx, opts = {}) => {
    opts.from ??= ctx.signers.holders[0];
    opts.operator ??= ctx.contracts.Vault;

    ctx.contracts.sERC20 = ctx.contracts.sERC20.connect(ctx.signers.holders[0]);
    ctx.data.tx = await ctx.contracts.sERC20.approve(opts.operator.address, ctx.constants.balance);
    ctx.data.receipt = await ctx.data.tx.wait();
  },
};

const spectralize = async (ctx, opts = {}) => {
  opts.collection ??= ctx.contracts.sERC721;
  opts.transfer ??= false;
  opts.derrida ??= DERRIDA;
  opts.short ??= false;
  opts.mock ??= false;

  if (opts.mock) {
    await mock.deploy.ERC721(ctx);

    ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(ctx.signers.root);
    ctx.data.tx = await ctx.contracts.sERC1155.spectralize(
      ctx.contracts.ERC721Mock.address,
      0,
      ctx.constants.name,
      ctx.constants.symbol,
      ctx.constants.cap,
      ctx.signers.admin.address,
      ctx.signers.owners[1].address
    );
    ctx.data.receipt = await ctx.data.tx.wait();
    ctx.data.id = ctx.data.receipt.events.filter((event) => event.event === 'Spectralize')[0].args.id;
    ctx.contracts.sERC20 = new ethers.Contract(await ctx.contracts.sERC1155.sERC20Of(ctx.data.id), SERC20.abi, ctx.signers.root);
  } else {
    if (opts.transfer) {
      const data = opts.short
        ? ethers.utils.concat([
            ethers.utils.formatBytes32String(ctx.constants.name),
            ethers.utils.formatBytes32String(ctx.constants.symbol),
            ethers.utils.defaultAbiCoder.encode(['uint256'], [ctx.constants.cap]),
            ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.sERC20.admin.address]),
            ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.owners[1].address]),
          ])
        : ethers.utils.concat([
            ethers.utils.formatBytes32String(ctx.constants.name),
            ethers.utils.formatBytes32String(ctx.constants.symbol),
            ethers.utils.defaultAbiCoder.encode(['uint256'], [ctx.constants.cap]),
            ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.sERC20.admin.address]),
            ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.owners[1].address]),
            ethers.utils.defaultAbiCoder.encode(['bytes32'], [opts.derrida]),
          ]);

      ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.owners[0]);
      ctx.data.tx = await ctx.contracts.sERC721['safeTransferFrom(address,address,uint256,bytes)'](
        ctx.signers.owners[0].address,
        ctx.contracts.sERC1155.address,
        ctx.data.tokenId,
        data
      );
      ctx.data.receipt = await ctx.data.tx.wait();
      ctx.data.id = (await ctx.contracts.sERC1155.queryFilter(ctx.contracts.sERC1155.filters.Spectralize())).filter(
        (event) => event.event === 'Spectralize'
      )[0].args.id;
      ctx.contracts.sERC20 = new ethers.Contract(await ctx.contracts.sERC1155.sERC20Of(ctx.data.id), SERC20.abi, ctx.signers.root);
    } else {
      ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(ctx.signers.root);
      ctx.data.tx = await ctx.contracts.sERC1155.spectralize(
        opts.collection.address,
        ctx.data.tokenId,
        ctx.constants.name,
        ctx.constants.symbol,
        ctx.constants.cap,
        ctx.signers.sERC20.admin.address,
        ctx.signers.owners[1].address
      );
      ctx.data.receipt = await ctx.data.tx.wait();
      ctx.data.id = ctx.data.receipt.events.filter((event) => event.event === 'Spectralize')[0].args.id;
      ctx.contracts.sERC20 = new ethers.Contract(await ctx.contracts.sERC1155.sERC20Of(ctx.data.id), SERC20.abi, ctx.signers.root);
    }
  }

  await await ctx.contracts.sERC20.connect(ctx.signers.sERC20.admin).grantRole(await ctx.contracts.sERC20.MINTER_ROLE(), ctx.signers.sERC20.minter.address);

  // ctx.sERC20 = new sERC20(ctx);

  ctx.sERC20 = await sERC20.at(ctx, await ctx.contracts.sERC1155.sERC20Of(ctx.data.id));
};

const transfer = {
  sERC20: async (ctx, opts = {}) => {
    opts.from ??= ctx.signers.holders[0];
    opts.to ??= ctx.contracts.SERC20Splitter;
    opts.amount ??= ctx.constants.amount;

    ctx.contracts.sERC20 = ctx.contracts.sERC20.connect(opts.from);
    ctx.data.tx = await ctx.contracts.sERC20.transfer(opts.to.address, opts.amount);
    ctx.data.receipt = await ctx.data.tx.wait();
  },
  sERC721: async (ctx, opts = {}) => {
    opts.from ??= ctx.signers.owners[0];
    opts.to ??= ctx.contracts.sERC1155;

    ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(opts.from);
    ctx.data.tx = await ctx.contracts.sERC721.transferFrom(opts.from.address, opts.to.address, ctx.data.tokenId);
    ctx.data.receipt = await ctx.data.tx.wait();
  },
};

const unlock = async (ctx, opts = {}) => {
  opts.from ??= ctx.signers.owners[1];
  opts.byAddress ??= false;

  ctx.contracts.sERC1155 = ctx.contracts.sERC1155.connect(opts.from);

  if (opts.byAddress) {
    ctx.data.tx = await ctx.contracts.sERC1155['unlock(address,address,bytes)'](
      ctx.contracts.sERC20.address,
      ctx.signers.owners[2].address,
      ethers.constants.HashZero
    );
  } else {
    ctx.data.tx = await ctx.contracts.sERC1155['unlock(uint256,address,bytes)'](ctx.data.id, ctx.signers.owners[2].address, ethers.constants.HashZero);
  }

  ctx.data.receipt = await ctx.data.tx.wait();
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

const itUpdatesOracleData = (ctx, opts = {}) => {
  //   const previousData = await pool.getMiscData();
  // await advanceTime(MINUTE * 10); // force index update
  // await action(await calcLastChangeBlock(lastChangeBlockOffset));
  // const currentMiscData = await pool.getMiscData();
  // expect(currentMiscData.oracleIndex).to.equal(previousData.oracleIndex.add(1));
  // expect(currentMiscData.oracleSampleCreationTimestamp).to.equal(await currentTimestamp());
};
const itCachesLogInvariantAndSupply = (ctx, opts = {}) => {};

const itJoinsPoolLikeExpected = (ctx, opts = {}) => {
  opts.init ??= false;
  opts.old ??= true;

  if (opts.init) {
    it('it collects pooled tokens', async () => {
      const { tokens, balances, lastChangeBlock } = await ctx.contracts.Vault.getPoolTokens(ctx.data.poolId);

      expect(balances[0]).to.equal(ctx.constants.pooledETH);
      expect(balances[1]).to.equal(ctx.constants.pooledSERC20);
    });

    it('it initializes pool invariant', async () => {
      const invariant = computeInvariant(
        [ctx.constants.pooledETH, ctx.constants.pooledSERC20],
        [ctx.constants.pool.ONE.sub(ctx.constants.pool.normalizedStartWeight), ctx.constants.pool.normalizedStartWeight]
      );
      expect(await ctx.contracts.SBP.getLastInvariant()).to.be.near(invariant, 100000);
      expect(await ctx.contracts.SBP.getInvariant()).to.be.near(invariant, 100000);
    });

    it('it mints LP tokens', async () => {
      const invariant = computeInvariant(
        [ctx.constants.pooledETH, ctx.constants.pooledSERC20],
        [ctx.constants.pool.ONE.sub(ctx.constants.pool.normalizedStartWeight), ctx.constants.pool.normalizedStartWeight]
      );
      expect(await ctx.contracts.SBP.balanceOf(ctx.signers.holders[0].address)).to.be.near(invariant.mul(2).sub(ctx.constants.pool.MINIMUM_BPT), 100000);
    });
  }

  if (!opts.init) {
  }

  if (opts.old) {
    it('it caches the log of the last invariant', async () => {
      //   function getMiscData()
      // external
      // view
      // returns (
      //     int256 logInvariant,
      //     int256 logTotalSupply,
      //     uint256 oracleSampleCreationTimestamp,
      //     uint256 oracleIndex,
      //     bool oracleEnabled,
      //     uint256 swapFeePercentage
      // )
    });
    it('it caches the total supply', async () => {});
  } else {
    it('it does not update the oracle data', async () => {});

    it('it does not cache the log of the last invariant and supply', async () => {});

    it('it does not cache the total supply', async () => {});
  }
};

module.exports = {
  initialize,
  computeInvariant,
  join,
  register,
  mint,
  mock,
  setApprovalForAll,
  safeBatchTransferFrom,
  safeTransferFrom,
  setup,
  spectralize,
  transfer,
  unlock,
  withdraw,
  withdrawBatch,
  itJoinsPoolLikeExpected,

  SERC20,
  SERC721,
  SERC1155,
};
