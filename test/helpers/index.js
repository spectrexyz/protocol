const SERC20 = require('../../artifacts/contracts/core/SERC20.sol/sERC20.json');
const SERC721 = require('../../artifacts/contracts/core/SERC721.sol/sERC721.json');
const SERC1155 = require('../../artifacts/contracts/core/SERC1155.sol/sERC1155.json');
const SERC20Splitter = require('../../artifacts/contracts/utils/SERC20Splitter.sol/SERC20Splitter.json');
const ERC1155Receiver = require('../../artifacts/contracts/test/ERC1155ReceiverMock.sol/ERC1155ReceiverMock.json');
const ERC721Mock = require('../../artifacts/contracts/test/ERC721Mock.sol/ERC721Mock.json');
const CloneFactory = require('../../artifacts/contracts/test/CloneFactory.sol/CloneFactory.json');
const WETH = require('../../artifacts/contracts/test/WETH.sol/WETH.json');
const Vault = require('../../artifacts/@balancer-labs/v2-vault/contracts/Vault.sol/Vault.json');
const Authorizer = require('../../artifacts/@balancer-labs/v2-vault/contracts/Authorizer.sol/Authorizer.json');
const SBP = require('../../artifacts/contracts/distribution/SpectralizationBootstrappingPool.sol/SpectralizationBootstrappingPool.json');
const OracleMock = require('../../artifacts/contracts/test/OracleMock.sol/OracleMock.json');

// const { deployContract } = require('ethereum-waffle');
const { waffle } = require('hardhat');
const { deployContract } = waffle;
const { expect, Assertion } = require('chai');
const { ethers, network } = require('hardhat');
const Decimal = require('decimal.js');
const RECEIVER_SINGLE_MAGIC_VALUE = '0xf23a6e61';
const RECEIVER_BATCH_MAGIC_VALUE = '0xbc197c81';
const DERRIDA = '0x1d2496c631fd6d8be20fb18c5c1fa9499e1f28016c62da960ec6dcf752f2f7ce';

Assertion.addMethod('near', function(actual, _epsilon) {
  const expected = this._obj;
  const delta = expected.sub(actual).abs();
  const epsilon = ethers.BigNumber.from(_epsilon);

  this.assert(delta.abs().lte(epsilon), 'expected #{exp} to be near #{act}', 'expected #{exp} to not be near #{act}', expected, actual);
});

const currentTimestamp = async () => {
  const { timestamp } = await network.provider.send('eth_getBlockByNumber', ['latest', true]);
  return ethers.BigNumber.from(timestamp);
};

const advanceTime = async (seconds) => {
  await ethers.provider.send('evm_increaseTime', [parseInt(seconds.toString())]);
  await ethers.provider.send('evm_mine', []);
};

const initialize = async (ctx) => {
  ctx.artifacts = {
    SERC20,
    SERC721,
    SERC1155,
  };

  ctx.constants = {
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
    assets: [ethers.constants.AddressZero, ctx.contracts.sERC20.address],
    maxAmountsIn: [ctx.constants.pooledETH, ctx.constants.pooledSERC20],
    userData: ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256[]'],
      [opts.init ? JOIN_KIND_INIT : JOIN_EXACT_TOKENS, [ctx.constants.pooledETH, ctx.constants.pooledSERC20]]
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
    opts.to ??= ctx.signers.holders[0];
    opts.amount ??= ctx.constants.balance;

    ctx.contracts.sERC20 = ctx.contracts.sERC20.connect(ctx.signers.admin);
    ctx.data.tx = await ctx.contracts.sERC20.mint(opts.to.address, opts.amount);
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

  ctx.contracts.sERC20Base = await deployContract(ctx.signers.root, SERC20);
  ctx.contracts.sERC721 = await deployContract(ctx.signers.root, SERC721, ['sERC721 Collection', 'sERC721']);
  ctx.contracts.sERC1155 = await deployContract(ctx.signers.root, SERC1155, [
    ctx.contracts.sERC20Base.address,
    ctx.constants.unavailableURI,
    ctx.constants.unlockedURI,
  ]);
  ctx.contracts.SERC20Splitter = await deployContract(ctx.signers.root, SERC20Splitter, [ctx.signers.admin.address]);
  ctx.contracts.OracleMock = await deployContract(ctx.signers.root, OracleMock);

  ctx.data.receipt = await (await ctx.contracts.sERC721.mint(ctx.signers.owners[0].address, ctx.constants.tokenURI)).wait();
  ctx.data.tokenId = ctx.data.receipt.events[0].args.tokenId.toString();

  if (opts.approve) {
    ctx.contracts.sERC721 = ctx.contracts.sERC721.connect(ctx.signers.owners[0]);
    await (await ctx.contracts.sERC721.approve(ctx.contracts.sERC1155.address, ctx.data.tokenId)).wait();
  }

  if (opts.balancer) {
    ctx.contracts.WETH = await deployContract(ctx.signers.root, WETH);
    ctx.contracts.Authorizer = await deployContract(ctx.signers.root, Authorizer, [ctx.signers.admin.address]);
    ctx.contracts.Vault = await deployContract(ctx.signers.root, Vault, [ctx.contracts.Authorizer.address, ctx.contracts.WETH.address, 0, 0]);
    await spectralize(ctx);
    await mint.sERC20(ctx);
    ctx.contracts.SBP = await deployContract(ctx.signers.root, SBP, [
      ctx.contracts.Vault.address,
      ctx.constants.pool.name,
      ctx.constants.pool.symbol,
      ctx.contracts.WETH.address,
      ctx.contracts.sERC20.address,
      ctx.constants.pool.normalizedStartWeight,
      ctx.constants.pool.normalizedEndWeight,
      ctx.constants.pool.swapFeePercentage,
      ctx.constants.pool.pauseWindowDuration,
      ctx.constants.pool.bufferPeriodDuration,
      false,
    ]);

    await approve.sERC20(ctx);

    ctx.data.poolId = await ctx.contracts.SBP.getPoolId();
  }
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
            ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.admin.address]),
            ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.owners[1].address]),
          ])
        : ethers.utils.concat([
            ethers.utils.formatBytes32String(ctx.constants.name),
            ethers.utils.formatBytes32String(ctx.constants.symbol),
            ethers.utils.defaultAbiCoder.encode(['uint256'], [ctx.constants.cap]),
            ethers.utils.defaultAbiCoder.encode(['address'], [ctx.signers.admin.address]),
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
        ctx.signers.admin.address,
        ctx.signers.owners[1].address
      );
      ctx.data.receipt = await ctx.data.tx.wait();
      ctx.data.id = ctx.data.receipt.events.filter((event) => event.event === 'Spectralize')[0].args.id;
      ctx.contracts.sERC20 = new ethers.Contract(await ctx.contracts.sERC1155.sERC20Of(ctx.data.id), SERC20.abi, ctx.signers.root);
    }
  }
  ctx.contracts.sERC20 = ctx.contracts.sERC20.connect(ctx.signers.admin);
  await await ctx.contracts.sERC20.grantRole(await ctx.contracts.sERC20.MINTER_ROLE(), ctx.signers.admin.address);
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

const itSafeTransfersFromLikeExpected = (ctx, opts = {}) => {
  it("it debits sender's balance", async () => {
    expect(await ctx.contracts.sERC20.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.constants.amount));
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id)).to.equal(ctx.constants.balance.sub(ctx.constants.amount));
  });

  it("it credits receiver's balance", async () => {
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(await ctx.contracts.sERC20.balanceOf(opts.to.address)).to.equal(ctx.constants.amount);
    expect(await ctx.contracts.sERC1155.balanceOf(opts.to.address, ctx.data.id)).to.equal(ctx.constants.amount);
  });

  it('it emits one TransferSingle event', async () => {
    opts.operator = opts.operator ? ctx.signers.operator : ctx.signers.holders[0];
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(ctx.data.receipt.events.filter((event) => event.event === 'TransferSingle').length).to.equal(1);
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'TransferSingle')
      .withArgs(opts.operator.address, ctx.signers.holders[0].address, opts.to.address, ctx.data.id, ctx.constants.amount);
  });
};

const itSafeBatchTransfersFromLikeExpected = (ctx, opts = { operator: undefined }) => {
  it("it debits sender's balance", async () => {
    expect(await ctx.data.sERC201.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.constants.amount1));
    expect(await ctx.data.sERC202.balanceOf(ctx.signers.holders[0].address)).to.equal(ctx.constants.balance.sub(ctx.constants.amount2));
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id1)).to.equal(ctx.constants.balance.sub(ctx.constants.amount1));
    expect(await ctx.contracts.sERC1155.balanceOf(ctx.signers.holders[0].address, ctx.data.id2)).to.equal(ctx.constants.balance.sub(ctx.constants.amount2));
  });

  it("it credits receiver's balance", async () => {
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(await ctx.data.sERC201.balanceOf(opts.to.address)).to.equal(ctx.constants.amount1);
    expect(await ctx.data.sERC202.balanceOf(opts.to.address)).to.equal(ctx.constants.amount2);
    expect(await ctx.contracts.sERC1155.balanceOf(opts.to.address, ctx.data.id1)).to.equal(ctx.constants.amount1);
    expect(await ctx.contracts.sERC1155.balanceOf(opts.to.address, ctx.data.id2)).to.equal(ctx.constants.amount2);
  });

  it('it emits one TransferBatch event', async () => {
    opts.operator = opts.operator ? ctx.signers.operator : ctx.signers.holders[0];
    opts.to = opts.mock ? ctx.contracts.ERC1155Receiver : ctx.signers.others[0];

    expect(ctx.data.receipt.events.filter((event) => event.event === 'TransferBatch').length).to.equal(1);
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'TransferBatch')
      .withArgs(
        opts.operator.address,
        ctx.signers.holders[0].address,
        opts.to.address,
        [ctx.data.id1, ctx.data.id2],
        [ctx.constants.amount1, ctx.constants.amount2]
      );
  });
};

const itSpectralizesLikeExpected = (ctx, opts = {}) => {
  it('it locks ERC721', async () => {
    expect(await ctx.contracts.sERC1155.isLocked(ctx.contracts.sERC721.address, ctx.data.tokenId)).to.equal(true);
    expect(await ctx.contracts.sERC1155.lockOf(ctx.contracts.sERC721.address, ctx.data.tokenId)).to.equal(ctx.data.id);
    expect(await ctx.contracts.sERC721.ownerOf(ctx.data.tokenId)).to.equal(ctx.contracts.sERC1155.address);
  });

  it('it emits a Lock event', async () => {
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'Lock')
      .withArgs(ctx.data.id);
  });

  it('it clones and initializes sERC20', async () => {
    expect(await ctx.contracts.sERC20.name()).to.equal(ctx.constants.name);
    expect(await ctx.contracts.sERC20.symbol()).to.equal(ctx.constants.symbol);
    expect(await ctx.contracts.sERC20.cap()).to.equal(ctx.constants.cap);
    expect(await ctx.contracts.sERC20.hasRole(await ctx.contracts.sERC20.DEFAULT_ADMIN_ROLE(), ctx.signers.admin.address)).to.equal(true);
  });

  it('it emits a TransferSingle event as per the ERC1155 standard', async () => {
    opts.operator = opts.transfer ? ctx.contracts.sERC721 : ctx.signers.root;

    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'TransferSingle')
      .withArgs(opts.operator.address, ethers.constants.AddressZero, ethers.constants.AddressZero, ctx.data.id, 0);
  });

  it('it registers spectre', async () => {
    const spectre = await ctx.contracts.sERC1155['spectreOf(uint256)'](ctx.data.id);

    expect(spectre.state).to.equal(ctx.constants.SpectreState.Locked);
    expect(spectre.collection).to.equal(ctx.contracts.sERC721.address);
    expect(spectre.tokenId).to.equal(ctx.data.tokenId);
    expect(spectre.guardian).to.equal(ctx.signers.owners[1].address);
  });

  it('it emits a Spectralize event', async () => {
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'Spectralize')
      .withArgs(ctx.contracts.sERC721.address, ctx.data.tokenId, ctx.data.id, ctx.contracts.sERC20.address, ctx.signers.owners[1].address);
  });
};

const itUnlocksLikeExpected = (ctx, opts = {}) => {
  it('it updates spectre state', async () => {
    const spectre = await ctx.contracts.sERC1155['spectreOf(uint256)'](ctx.data.id);

    expect(spectre.state).to.equal(ctx.constants.SpectreState.Unlocked);
  });

  it('it updates NFT lock', async () => {
    expect(await ctx.contracts.sERC1155.lockOf(ctx.contracts.sERC721.address, ctx.data.id)).to.equal(0);
  });

  it('it emits an Unlock event', async () => {
    await expect(ctx.data.tx)
      .to.emit(ctx.contracts.sERC1155, 'Unlock')
      .withArgs(ctx.data.id, ctx.signers.owners[2].address);
  });

  it('it transfers NFT', async () => {
    expect(await ctx.contracts.sERC721.ownerOf(ctx.data.tokenId)).to.equal(ctx.signers.owners[2].address);
  });
};

module.exports = {
  initialize,
  computeInvariant,
  currentTimestamp,
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
  itSafeBatchTransfersFromLikeExpected,
  itSafeTransfersFromLikeExpected,
  itSpectralizesLikeExpected,
  itUnlocksLikeExpected,
  CloneFactory,
  SERC20Splitter,
  SERC20,
  SERC721,
  SERC1155,
};
